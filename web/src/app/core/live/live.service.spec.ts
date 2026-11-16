import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import { AuthStore } from '@/core/auth'
import type { AuthUser } from '@/core/auth'
import { NetworkStatusService } from '@/core/network'
import { LiveService, POKE_DELAY_MS } from './live.service'
import type { LiveListener } from './live.type'

const user: AuthUser = {
  id: 'u1',
  email: 'u1@example.com',
  displayName: 'mom',
  avatarUrl: null,
  timezone: 'Asia/Bangkok',
  hasPassword: false,
  phone: null,
  identities: [],
}
const envelope = <T>(data: T) => ({ message: 'ok', timestamp: '', data })
const settle = async (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms))

/** A fake `GET /live/events`: each `poke(...)` writes one event to the open stream. */
const fakeStream = () => {
  const encoder = new TextEncoder()
  let controller: ReadableStreamDefaultController<Uint8Array> | null = null
  const calls: RequestInit[] = []
  const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
    calls.push(init)
    const body = new ReadableStream<Uint8Array>({
      start(c) {
        controller = c
      },
    })
    init.signal?.addEventListener('abort', () => controller?.error(new Error('aborted')))
    return Promise.resolve(new Response(body, { status: 200 }))
  })
  return {
    fetchMock,
    calls,
    poke: (data: object) => {
      try {
        controller?.enqueue(encoder.encode(`event: poke\ndata: ${JSON.stringify(data)}\n\n`))
      } catch {
        // The stream was closed: nothing reaches the device.
      }
    },
  }
}

describe('LiveService', () => {
  let http: HttpTestingController
  let service: LiveService
  let stream: ReturnType<typeof fakeStream>
  let pokes: number
  let cursor: number
  const listener: LiveListener = {
    deviceId: () => 'mine',
    cursor: () => cursor,
    onPoke: () => pokes++,
  }

  const answerToken = async (provider: 'local' | 'disabled') => {
    await settle()
    http.expectOne('/api/live/token').flush(envelope({ provider }))
    await settle()
  }

  beforeEach(() => {
    stream = fakeStream()
    vi.stubGlobal('fetch', stream.fetchMock)
    pokes = 0
    cursor = 10
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] })
    TestBed.inject(AuthStore).setSession({ accessToken: 'token-1', expiresIn: 600, user })
    http = TestBed.inject(HttpTestingController)
    service = TestBed.inject(LiveService)
  })

  afterEach(() => {
    TestBed.resetTestingModule()
    vi.unstubAllGlobals()
  })

  it('connects only once someone listens (rule 10)', async () => {
    TestBed.tick()
    await settle()
    http.expectNone('/api/live/token')
    service.listenUser(listener)
    TestBed.tick()
    await answerToken('local')
    expect(service.provider()).toBe('local')
    expect(service.connected()).toBe(true)
  })

  it('reads the stream with the bearer header, never a token in the URL (rule 9)', async () => {
    service.listenUser(listener)
    TestBed.tick()
    await answerToken('local')
    expect(stream.fetchMock).toHaveBeenCalledWith('/api/live/events', expect.anything())
    expect(stream.calls[0].headers).toMatchObject({ Authorization: 'Bearer token-1' })
  })

  it('opens no stream when the API has live sync off', async () => {
    service.listenUser(listener)
    TestBed.tick()
    await answerToken('disabled')
    expect(service.provider()).toBe('disabled')
    expect(stream.fetchMock).not.toHaveBeenCalled()
  })

  it('runs the listener once for pokes within 300 ms, ignoring own and old ones (rules 5, 11)', async () => {
    service.listenUser(listener)
    TestBed.tick()
    await answerToken('local')
    stream.poke({ channel: 'user:u1', seq: 11, deviceId: 'mine' })
    stream.poke({ channel: 'user:u1', seq: 9, deviceId: 'other' })
    await settle(POKE_DELAY_MS + 50)
    expect(pokes).toBe(0)
    stream.poke({ channel: 'user:u1', seq: 11, deviceId: 'other' })
    stream.poke({ channel: 'user:u1', seq: 12, deviceId: 'other' })
    await settle(POKE_DELAY_MS + 50)
    expect(pokes).toBe(1)
  })

  it("hears a shared profile's pokes only while that profile is listened to", async () => {
    let profilePokes = 0
    service.listenUser(listener)
    const stop = service.listenProfile('pa', { ...listener, onPoke: () => profilePokes++ })
    TestBed.tick()
    await answerToken('local')
    stream.poke({ channel: 'profile:pb', seq: 20, deviceId: 'other' })
    stream.poke({ channel: 'profile:pa', seq: 20, deviceId: 'other' })
    await settle(POKE_DELAY_MS + 50)
    expect(profilePokes).toBe(1)
    stop()
    stream.poke({ channel: 'profile:pa', seq: 21, deviceId: 'other' })
    await settle(POKE_DELAY_MS + 50)
    expect(profilePokes).toBe(1)
    expect(pokes).toBe(0)
  })

  it('stops listening offline and in the background (rule 10)', async () => {
    service.listenUser(listener)
    TestBed.tick()
    await answerToken('local')
    TestBed.inject(NetworkStatusService).isOnline.set(false)
    TestBed.tick()
    expect(service.connected()).toBe(false)
    stream.poke({ channel: 'user:u1', seq: 30, deviceId: 'other' })
    await settle(POKE_DELAY_MS + 50)
    expect(pokes).toBe(0)
  })

  it('stays quiet when the token request fails (rule 13)', async () => {
    service.listenUser(listener)
    TestBed.tick()
    await settle()
    http.expectOne('/api/live/token').flush('down', { status: 503, statusText: 'Down' })
    await settle()
    expect(service.connected()).toBe(false)
    expect(service.provider()).toBeNull()
  })
})
