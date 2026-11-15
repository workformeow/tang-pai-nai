// docs/features/live-sync.md. Mirrors the API's `core/live` types.

export type LiveProvider = 'ably' | 'local' | 'disabled'

/** Rule 4: "something changed", never data. */
export interface LivePoke {
  seq: number
  deviceId: string
}

/** `POST /live/token` (rule 8). */
export type LiveTokenData =
  { provider: 'ably'; tokenRequest: unknown } | { provider: 'local' } | { provider: 'disabled' }

/** What a listener of one channel needs (rules 5, 11). */
export interface LiveListener {
  /** This device's id: its own pokes are ignored. */
  deviceId: () => string | null
  /** What the device already has: a poke not newer than it is ignored. */
  cursor: () => number
  /** Runs once per burst of pokes (300 ms). */
  onPoke: () => void
}
