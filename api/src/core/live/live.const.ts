export const LIVE_LIMITS = {
  /** Rule 7: a publish that takes longer is given up (and logged). */
  PUBLISH_TIMEOUT_MS: 1_000,
  /** Rule 8: an Ably token lasts 1 hour; the SDK asks for the next one by itself. */
  TOKEN_TTL_MS: 60 * 60 * 1_000,
} as const
