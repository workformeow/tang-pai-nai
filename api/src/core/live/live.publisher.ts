import { logger } from '@/core/logger'
import { LOG } from '@/shared/constants'
import { LIVE_LIMITS } from './live.const'
import type { LiveMessage, LiveProvider } from './live.type'

export interface LivePublisher {
  /** Rule 7: every message at once, each within the timeout. Never throws. */
  publish(messages: LiveMessage[]): Promise<void>
}

const timeout = async (ms: number): Promise<never> =>
  new Promise((_resolve, reject) => {
    setTimeout(() => {
      reject(new Error(`timed out after ${ms} ms`))
    }, ms).unref()
  })

export const createLivePublisher = (
  provider: Pick<LiveProvider, 'name' | 'publish'>,
  timeoutMs: number = LIVE_LIMITS.PUBLISH_TIMEOUT_MS
): LivePublisher => ({
  publish: async (messages) => {
    await Promise.all(
      messages.map(async (message) => {
        try {
          await Promise.race([provider.publish(message), timeout(timeoutMs)])
        } catch (error) {
          // Ids only: the channel names a user or profile id, never data.
          logger.warn(LOG.LIVE.publishFailed(provider.name), {
            channel: message.channel,
            cause: error instanceof Error ? error.message : String(error),
          })
        }
      })
    )
  },
})
