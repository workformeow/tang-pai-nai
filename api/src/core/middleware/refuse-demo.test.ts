import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '@/core/error'
import { HttpStatus } from '@/shared/constants'
import { DEMO_NOT_ALLOWED, refuseDemo } from './refuse-demo'
import type { Request, Response } from 'express'

const next = vi.fn<(err?: unknown) => void>()
const req = (userId?: string): Request =>
  ({ auth: userId ? { userId, sessionFamilyId: 'family' } : undefined }) as Request
const isDemo = async (userId: string) => Promise.resolve(userId === 'demo')

const errorOf = (): AppError | undefined => {
  const error: unknown = next.mock.calls[0]?.[0]
  return error instanceof AppError ? error : undefined
}

beforeEach(() => {
  next.mockClear()
})

describe('refuseDemo', () => {
  it('refuses a demo user with 403 DEMO_NOT_ALLOWED (demo rule 9)', async () => {
    await refuseDemo(isDemo)(req('demo'), {} as Response, next)

    expect(errorOf()?.status).toBe(HttpStatus.FORBIDDEN)
    expect(errorOf()?.code).toBe(DEMO_NOT_ALLOWED)
  })

  it('lets anyone else through', async () => {
    await refuseDemo(isDemo)(req('someone'), {} as Response, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('leaves a request without a caller to `authenticate`', async () => {
    await refuseDemo(isDemo)(req(), {} as Response, next)

    expect(next).toHaveBeenCalledWith()
  })

  it('passes a failed lookup on to the error handler', async () => {
    const failure = new Error('db down')

    await refuseDemo(async () => Promise.reject(failure))(req('demo'), {} as Response, next)

    expect(next).toHaveBeenCalledWith(failure)
  })
})
