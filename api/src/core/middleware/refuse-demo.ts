import { ForbiddenError } from '@/core/error'
import { ERRORS } from '@/shared/constants'
import type { NextFunction, Request, RequestHandler, Response } from 'express'

/** `code` of the refusal: the web shows "ใช้ไม่ได้ในโหมด Demo". */
export const DEMO_NOT_ALLOWED = 'DEMO_NOT_ALLOWED'

/**
 * Demo rule 9: behind `authenticate`, `403 DEMO_NOT_ALLOWED` for a demo user, so a demo can't
 * change a credential, share a book or send a mail or an SMS. Each feature passes its own
 * lookup (features can't import each other).
 */
export const refuseDemo =
  (isDemo: (userId: string) => Promise<boolean>): RequestHandler =>
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.auth && (await isDemo(req.auth.userId))) {
        next(
          new ForbiddenError(ERRORS.DEMO_NOT_ALLOWED)
            .withCode(DEMO_NOT_ALLOWED)
            .withOperation('refuseDemo')
        )
        return
      }
      next()
    } catch (error) {
      next(error)
    }
  }
