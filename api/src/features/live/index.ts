import { db } from '@/core/database'
import { liveProvider } from '@/core/live'
import { createLiveController } from './live.controller'
import { createDrizzleLiveRepository } from './live.repository.drizzle'
import { createLiveRouter } from './live.routes'
import { createLiveService } from './live.service'

const liveService = createLiveService({
  liveRepo: createDrizzleLiveRepository(db),
  provider: liveProvider,
})

export const liveRouter = createLiveRouter(createLiveController(liveService))
