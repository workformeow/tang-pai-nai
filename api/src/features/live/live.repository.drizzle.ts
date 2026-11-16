import type { Executor } from '@/core/database'
import { listenableBooks } from '@/core/database/live-access'
import { wrapUnexpected } from '@/core/error'
import type { LiveRepository } from './live.repository'

export const createDrizzleLiveRepository = (db: Executor): LiveRepository => ({
  listenableBooks: async (userId) =>
    wrapUnexpected(async () => listenableBooks(db, userId), {
      operation: 'liveRepository.listenableBooks',
    }),
})
