import { Router } from 'express'
import { authenticate, refuseDemo, validate } from '@/core/middleware'
import { sharingSchema as s } from './sharing.schema'
import type { SharingController } from './sharing.controller'

export const createSharingRouter = (
  c: SharingController,
  isDemo: (userId: string) => Promise<boolean> = async () => Promise.resolve(false)
): Router => {
  const router = Router()
  router.use(authenticate)
  // Demo rule 9: a demo has no second person: it can't invite or join (reads stay, empty).
  const noDemo = refuseDemo(isDemo)

  // Owner (docs/features/sharing.md → Endpoints)
  router.get('/books/:bookId', validate(s.ofBook), c.ofBook)
  router.post('/books/:bookId/invites', noDemo, validate(s.invite), c.invite)
  router.put('/books/:bookId/members/:userId', validate(s.member), c.updateMember)
  router.delete('/books/:bookId/members/:userId', validate(s.byMember), c.removeMember)
  router.post('/invites/:id/resend', noDemo, validate(s.resend), c.resend)
  router.delete('/invites/:id', validate(s.byInvite), c.cancel)

  // Member
  router.get('/with-me', c.withMe)
  router.delete('/with-me/:bookId', validate(s.leave), c.leave)
  router.post('/invites/:id/accept', noDemo, validate(s.byInvite), c.accept)
  router.post('/invites/:id/decline', validate(s.byInvite), c.decline)
  router.get('/with-me/:bookId/rows', validate(s.rows), c.rows)

  return router
}
