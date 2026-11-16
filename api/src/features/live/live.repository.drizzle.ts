import type { Executor } from '@/core/database'
import { listenableProfiles } from '@/core/database/live-access'
import { wrapUnexpected } from '@/core/error'
import type { LiveRepository } from './live.repository'

export const createDrizzleLiveRepository = (db: Executor): LiveRepository => ({
  listenableProfiles: async (userId) =>
    wrapUnexpected(async () => listenableProfiles(db, userId), {
      operation: 'liveRepository.listenableProfiles',
    }),
})
