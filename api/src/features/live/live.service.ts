import { NotFoundError } from '@/core/error'
import type { LiveMessage, LiveProvider, LiveToken } from '@/core/live'
import { LiveProviderName } from '@/shared/types'
import { LIVE_MESSAGE } from './live.const'
import type { LiveRepository } from './live.repository'

export interface LiveServiceDeps {
  liveRepo: LiveRepository
  provider: Pick<LiveProvider, 'name' | 'token' | 'listen'>
}

/** docs/features/live-sync.md rules 3, 8–9: who may listen, and how. */
export const createLiveService = ({ liveRepo, provider }: LiveServiceDeps) => {
  /** Rule 8: an Ably token for the channels the user may hear now; else just the provider. */
  const token = async (userId: string): Promise<LiveToken> => {
    const bookIds =
      provider.name === LiveProviderName.ABLY ? await liveRepo.listenableBooks(userId) : []
    return provider.token({ userId, bookIds })
  }

  /**
   * Rule 9 (`local` only, else 404): adds a listener for the user's stream. Rule 3 is asked again
   * on each `book:` poke. Answers the function that removes it.
   */
  const listen = (userId: string, send: (message: LiveMessage) => void): (() => void) => {
    if (provider.name !== LiveProviderName.LOCAL || !provider.listen) {
      throw new NotFoundError(LIVE_MESSAGE.STREAM).withOperation('liveListen')
    }
    return provider.listen({
      userId,
      send,
      mayListen: async (bookId) => (await liveRepo.listenableBooks(userId)).includes(bookId),
    })
  }

  return { token, listen }
}

export type LiveService = ReturnType<typeof createLiveService>
