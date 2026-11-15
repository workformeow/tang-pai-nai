import {
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  Service,
  signal,
  untracked,
} from '@angular/core'
import { ApiClient } from '@/core/api'
import { AuthStore } from '@/core/auth'
import { NetworkStatusService } from '@/core/network'
import { readEventStream } from './live-stream'
import type { LiveListener, LivePoke, LiveProvider, LiveTokenData } from './live.type'
import type * as Ably from 'ably'

/** Rule 11: pokes within this time run one round. */
export const POKE_DELAY_MS = 300
/** Rule 13: the `local` stream's retries, like offline-sync rule 11's; the last one repeats. */
export const STREAM_RETRY_MS = [5_000, 15_000, 30_000, 60_000, 120_000, 300_000] as const
const EVENTS_URL = '/api/live/events'
const USER = 'user'

/** One open connection: the user it listens for, the channels it follows, and how it ends. */
interface Connection {
  userId: string
  follow(channels: readonly string[]): void
  close(): void
}

const isPoke = (value: unknown): value is LivePoke =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as LivePoke).seq === 'number' &&
  typeof (value as LivePoke).deviceId === 'string'

/**
 * Live sync (docs/features/live-sync.md rules 8–13): listens for pokes while the device is signed
 * in, online and in the foreground, and someone listens. It owns the connection only:
 * `SyncService` and `SharingService` each listen to their channel and run their own round. A
 * failure is quiet; the timed rounds still run.
 */
@Service()
export class LiveService {
  private window = inject(DOCUMENT).defaultView
  private api = inject(ApiClient)
  private authStore = inject(AuthStore)
  private network = inject(NetworkStatusService)

  /** What the API uses, once asked (null before): the sync sheet hides the line for `disabled`. */
  provider = signal<LiveProvider | null>(null)
  /** Whether pokes can reach this device right now. */
  connected = signal(false)

  /** `user` (own data) and `profile:<id>` (a shared profile in use), each with its listener. */
  private listeners = signal<ReadonlyMap<string, LiveListener>>(new Map())
  private visible = signal(this.window?.document.visibilityState !== 'hidden')
  private userId = computed(() => this.authStore.user()?.id ?? null)
  /** Rule 10: signed in, online, in the foreground, with someone listening. */
  private active = computed(
    () =>
      this.authStore.status() === 'signedIn' &&
      this.network.isOnline() &&
      this.visible() &&
      this.listeners().size > 0
  )

  private connection: Connection | null = null
  /** The user being listened for (connected, connecting or waiting to retry). */
  private target: string | null = null
  /** Bumped on every open / close: work of an older connection stops when it sees a new one. */
  private generation = 0
  private tokenRetry: ReturnType<typeof setTimeout> | null = null
  private tokenStep = 0
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor() {
    effect(() => {
      const userId = this.active() ? this.userId() : null
      untracked(() => {
        if (userId) {
          this.open(userId)
        } else {
          this.close()
        }
      })
    })
    effect(() => {
      const keys = [...this.listeners().keys()]
      untracked(() => this.follow(keys))
    })
    const onVisibility = () => this.visible.set(this.window?.document.visibilityState !== 'hidden')
    this.window?.document.addEventListener('visibilitychange', onVisibility)
    inject(DestroyRef).onDestroy(() => {
      this.window?.document.removeEventListener('visibilitychange', onVisibility)
      this.close()
    })
  }

  /** Pokes on the user's own channel (rule 11: a sync round). Answers how to stop. */
  listenUser(listener: LiveListener): () => void {
    return this.listen(USER, listener)
  }

  /** Pokes of a shared profile in use (rule 10). Answers how to stop. */
  listenProfile(profileId: string, listener: LiveListener): () => void {
    return this.listen(`profile:${profileId}`, listener)
  }

  private listen(key: string, listener: LiveListener): () => void {
    this.listeners.update((map) => new Map(map).set(key, listener))
    return () => {
      if (this.listeners().get(key) !== listener) {
        return
      }
      this.listeners.update((map) => {
        const next = new Map(map)
        next.delete(key)
        return next
      })
      this.clearTimer(key)
    }
  }

  private channelName(key: string, userId: string): string {
    return key === USER ? `user:${userId}` : key
  }

  private follow(keys: readonly string[]): void {
    const connection = this.connection
    connection?.follow(keys.map((key) => this.channelName(key, connection.userId)))
  }

  private open(userId: string): void {
    if (this.target === userId) {
      return
    }
    this.close()
    this.target = userId
    void this.start(userId, this.generation)
  }

  private close(): void {
    this.target = null
    this.generation++
    this.connection?.close()
    this.connection = null
    this.connected.set(false)
    if (this.tokenRetry) {
      clearTimeout(this.tokenRetry)
      this.tokenRetry = null
    }
    for (const key of [...this.timers.keys()]) {
      this.clearTimer(key)
    }
  }

  /** Rule 8: ask the API how to listen, then connect. A failure retries quietly (rule 13). */
  private async start(userId: string, generation: number): Promise<void> {
    try {
      const data = (await this.api.post<LiveTokenData>('/live/token')).data
      if (generation !== this.generation || !data) {
        return
      }
      this.tokenStep = 0
      this.provider.set(data.provider)
      if (data.provider === 'disabled') {
        return
      }
      const connection =
        data.provider === 'local'
          ? this.localStream(userId, generation)
          : await this.ably(userId, data.tokenRequest)
      if (generation !== this.generation) {
        connection.close()
        return
      }
      this.connection = connection
      this.follow([...this.listeners().keys()])
    } catch {
      if (generation !== this.generation) {
        return
      }
      const delay = STREAM_RETRY_MS[Math.min(this.tokenStep++, STREAM_RETRY_MS.length - 1)]
      this.tokenRetry = setTimeout(() => {
        this.tokenRetry = null
        if (generation === this.generation) {
          void this.start(userId, generation)
        }
      }, delay)
    }
  }

  /** Rule 5 and 11: own and old pokes ignored, the rest run the listener once per 300 ms. */
  private receive(channel: string, poke: unknown): void {
    const userId = this.connection?.userId
    const key = channel === `user:${userId}` ? USER : channel
    const listener = this.listeners().get(key)
    if (!listener || !isPoke(poke) || this.timers.has(key)) {
      return
    }
    if (poke.deviceId === listener.deviceId() || poke.seq <= listener.cursor()) {
      return
    }
    this.timers.set(
      key,
      setTimeout(() => {
        this.timers.delete(key)
        this.listeners().get(key)?.onPoke()
      }, POKE_DELAY_MS)
    )
  }

  private clearTimer(key: string): void {
    const timer = this.timers.get(key)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(key)
    }
  }

  /**
   * Rule 9: the API's own stream, read with `fetch` and the usual bearer (never a token in the
   * URL). It hears every channel the user may (the API checks rule 3); `receive` keeps only those
   * listened to. The API ends it every few minutes; it opens again at once.
   */
  private localStream(userId: string, generation: number): Connection {
    const abort = new AbortController()
    const live = () => !abort.signal.aborted && generation === this.generation
    const run = async () => {
      let step = 0
      while (live()) {
        try {
          const response = await fetch(EVENTS_URL, {
            headers: {
              Authorization: `Bearer ${this.authStore.accessToken() ?? ''}`,
              // Straight to the network: the service worker would hold the stream.
              'ngsw-bypass': 'true',
            },
            cache: 'no-store',
            signal: abort.signal,
          })
          if (response.status === 401) {
            // The access token ran out: a call through the API client refreshes it.
            await this.api.post('/live/token').catch(() => undefined)
          }
          if (!response.ok || !response.body) {
            throw new Error(`live stream ${response.status}`)
          }
          step = 0
          this.connected.set(true)
          await readEventStream(response.body, (event) => {
            if (event.event === 'poke') {
              const { channel, ...poke } = JSON.parse(event.data) as { channel: string }
              this.receive(channel, poke)
            }
          })
          this.connected.set(false)
        } catch {
          if (!live()) {
            return
          }
          this.connected.set(false)
          await wait(STREAM_RETRY_MS[Math.min(step++, STREAM_RETRY_MS.length - 1)], abort.signal)
        }
      }
    }
    void run()
    return {
      userId,
      follow: () => undefined,
      close: () => abort.abort(),
    }
  }

  /**
   * Rule 8: Ably Realtime, loaded only now (it stays out of the shell's bundle). The SDK asks
   * `/live/token` for each new token and retries with its own back-off.
   */
  private async ably(userId: string, tokenRequest: unknown): Promise<Connection> {
    const { Realtime } = await import('ably')
    let first: unknown = tokenRequest
    const nextToken = async (): Promise<unknown> => {
      if (first) {
        const token = first
        first = null
        return token
      }
      const data = (await this.api.post<LiveTokenData>('/live/token')).data
      if (data?.provider !== 'ably') {
        throw new Error('live provider changed')
      }
      return data.tokenRequest
    }
    const realtime = new Realtime({
      authCallback: (_params, callback) => {
        nextToken().then(
          (token) => callback(null, token as Ably.TokenRequest),
          (error: unknown) => callback(String(error), null)
        )
      },
      echoMessages: false,
      closeOnUnload: true,
    })
    realtime.connection.on((change) => this.connected.set(change.current === 'connected'))
    const channels = new Map<string, Ably.RealtimeChannel>()
    const attach = (name: string) => {
      const channel = realtime.channels.get(name)
      channels.set(name, channel)
      channel
        .subscribe('poke', (message) => this.receive(name, message.data))
        .catch(async () => {
          // A profile shared after the token was made: a new token carries it (rule 8).
          await realtime.auth.authorize().catch(() => undefined)
          await channel.attach().catch(() => undefined)
        })
    }
    return {
      userId,
      follow: (names) => {
        for (const [name, channel] of channels) {
          if (!names.includes(name)) {
            channel.unsubscribe()
            channel.detach().catch(() => undefined)
            channels.delete(name)
          }
        }
        for (const name of names) {
          if (!channels.has(name)) {
            attach(name)
          }
        }
      },
      close: () => {
        realtime.close()
        this.connected.set(false)
      },
    }
  }
}

const wait = async (ms: number, signal: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      resolve()
    })
  })
