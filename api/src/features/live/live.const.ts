export const LIVE_MESSAGE = {
  TOKEN: 'Live sync token issued',
  STREAM: 'Live stream',
} as const

export const LIVE_STREAM = {
  /** A comment line keeps proxies from closing a quiet stream. */
  HEARTBEAT_MS: 25_000,
  /**
   * The stream ends after this; the device opens a new one with a fresh access token, so a
   * signed-out session stops hearing pokes soon after.
   */
  MAX_AGE_MS: 10 * 60 * 1_000,
} as const
