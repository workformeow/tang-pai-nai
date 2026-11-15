import type { LiveProviderName } from '@/shared/types'

// docs/features/live-sync.md. A poke says only "something changed" (rule 4): never data.

/** `user:<userId>` (one user's own devices) or `profile:<profileId>` (a shared profile's viewers). */
export type LiveChannel = `user:${string}` | `profile:${string}`

/** Rule 4: the highest `changeSeq` the push stamped and the device that pushed. */
export interface LivePoke {
  seq: number
  deviceId: string
}

/** One poke on one channel. */
export interface LiveMessage {
  channel: LiveChannel
  poke: LivePoke
}

/** What a device may listen to (rule 3): its `user:` channel and these `profile:` channels. */
export interface LiveGrant {
  userId: string
  profileIds: string[]
}

/** `POST /live/token`: how the device listens (rule 8). */
export type LiveToken =
  | { provider: LiveProviderName.ABLY; tokenRequest: unknown }
  | { provider: LiveProviderName.LOCAL }
  | { provider: LiveProviderName.DISABLED }

/** A listener of the `local` stream (rule 9): one open `GET /live/events`. */
export interface LiveListener {
  userId: string
  /** Rule 3, asked on each `profile:` poke (membership may end while the stream is open). */
  mayListen(profileId: string): Promise<boolean>
  send(message: LiveMessage): void
}

/** Port every live provider implements. Only the API publishes (rule 2). */
export interface LiveProvider {
  readonly name: LiveProviderName
  publish(message: LiveMessage): Promise<void>
  token(grant: LiveGrant): Promise<LiveToken>
  /** `local` only: adds a stream listener; answers the function that removes it. */
  listen?(listener: LiveListener): () => void
  close?(): Promise<void>
}
