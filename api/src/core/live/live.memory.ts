import { LiveProviderName } from '@/shared/types'
import type { LiveGrant, LiveMessage, LiveProvider } from './live.type'

/** An in-memory fake for specs: keeps what was published and the grants asked for. */
export const createMemoryLiveProvider = (
  name: LiveProviderName = LiveProviderName.ABLY
): LiveProvider & { published: LiveMessage[]; grants: LiveGrant[] } => {
  const published: LiveMessage[] = []
  const grants: LiveGrant[] = []
  return {
    name,
    published,
    grants,
    publish: async (message) => {
      published.push(message)
      return Promise.resolve()
    },
    token: async (grant) => {
      grants.push(grant)
      return Promise.resolve(
        name === LiveProviderName.ABLY
          ? { provider: LiveProviderName.ABLY, tokenRequest: { capability: grant } }
          : { provider: name }
      )
    },
  }
}
