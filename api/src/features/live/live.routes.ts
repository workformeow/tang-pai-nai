import { Router } from 'express'
import { authenticate } from '@/core/middleware'
import type { LiveController } from './live.controller'

// docs/features/live-sync.md → Endpoints.
export const createLiveRouter = (liveController: LiveController): Router => {
  const router = Router()
  router.use(authenticate)

  router.post('/token', liveController.token)
  router.get('/events', liveController.events)

  return router
}
