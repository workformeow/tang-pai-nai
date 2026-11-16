import { createHttpClient } from '@ably/pubsub-server'
import { LiveProviderName } from '@/shared/types'
import { profileChannel, userChannel } from './live.channel'
import { LIVE_LIMITS } from './live.const'
import type { LiveProvider } from './live.type'

/**
 * Rule 8: Ably (staging, production). The API publishes over Ably's REST API and hands devices a
 * signed token request that may only subscribe, for 1 hour, to the channels they may hear.
 *
 * `@ably/pubsub-server` declares this client a server (an API key needs nothing more), so it is not
 * counted as a monthly active user. The token carries the user's id as its `clientId`: an account
 * billed by MAU rejects a device connection without one.
 */
export const createAblyLiveProvider = ({ apiKey }: { apiKey: string }): LiveProvider => {
  const rest = createHttpClient({
    key: apiKey,
    httpRequestTimeout: LIVE_LIMITS.PUBLISH_TIMEOUT_MS,
    // A failed publish is dropped (rule 7): no retry against Ably's fallback hosts.
    httpMaxRetryCount: 0,
  })

  return {
    name: LiveProviderName.ABLY,
    publish: async ({ channel, poke }) => {
      await rest.channels.get(channel).publish('poke', poke)
    },
    token: async ({ userId, profileIds }) => {
      const channels = [userChannel(userId), ...profileIds.map(profileChannel)]
      const capability = Object.fromEntries(channels.map((name) => [name, ['subscribe']]))
      const tokenRequest = await rest.auth.createTokenRequest({
        clientId: userId,
        capability: JSON.stringify(capability),
        ttl: LIVE_LIMITS.TOKEN_TTL_MS,
      })
      return { provider: LiveProviderName.ABLY, tokenRequest }
    },
  }
}
