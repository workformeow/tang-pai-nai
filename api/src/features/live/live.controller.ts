import { AppError } from '@/core/error'
import { ERRORS, ErrorSeverity, HttpStatus } from '@/shared/constants'
import { createResponse } from '@/shared/utils'
import { LIVE_MESSAGE, LIVE_STREAM } from './live.const'
import type { LiveService } from './live.service'
import type { NextFunction, Request, Response } from 'express'

const userIdOf = (req: Request): string => {
  if (!req.auth) {
    throw new AppError(ERRORS.UNAUTHORIZED, HttpStatus.UNAUTHORIZED, ErrorSeverity.WARN)
  }
  return req.auth.userId
}

export const createLiveController = (
  liveService: LiveService,
  stream: { heartbeatMs: number; maxAgeMs: number } = {
    heartbeatMs: LIVE_STREAM.HEARTBEAT_MS,
    maxAgeMs: LIVE_STREAM.MAX_AGE_MS,
  }
) => {
  /** `POST /live/token` (rule 8). */
  const token = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await liveService.token(userIdOf(req))
      res.status(HttpStatus.OK).json(createResponse(LIVE_MESSAGE.TOKEN, data))
    } catch (error) {
      next(error)
    }
  }

  /** `GET /live/events` (rule 9): server-sent `poke` events while the request stays open. */
  const events = (req: Request, res: Response, next: NextFunction): void => {
    let stop: () => void
    try {
      stop = liveService.listen(userIdOf(req), (message) => {
        res.write(
          `event: poke\ndata: ${JSON.stringify({ channel: message.channel, ...message.poke })}\n\n`
        )
      })
    } catch (error) {
      next(error)
      return
    }
    res.status(HttpStatus.OK)
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      // nginx (Docker) would otherwise buffer the stream.
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders()
    res.write(': open\n\n')

    const heartbeat = setInterval(() => res.write(': ping\n\n'), stream.heartbeatMs)
    const end = () => {
      clearInterval(heartbeat)
      clearTimeout(maxAge)
      stop()
    }
    const maxAge = setTimeout(() => {
      end()
      res.end()
    }, stream.maxAgeMs)
    req.on('close', end)
  }

  return { token, events }
}

export type LiveController = ReturnType<typeof createLiveController>
