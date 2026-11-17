import cookieParser from 'cookie-parser'
import express from 'express'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { errorHandler } from '@/core/error'
import { accessTokens, skipBreachCheck } from '@/core/security'
import { HttpStatus } from '@/shared/constants'
import type { AppResponse } from '@/shared/types'
import { REFRESH_COOKIE } from './auth.const'
import { createAuthController } from './auth.controller'
import { createMemoryAuthRepository } from './auth.repository.memory'
import { createAuthRouter } from './auth.routes'
import { createAuthService } from './auth.service'
import type { BotCheck } from './auth.service'
import type { AuthProvidersData, AuthSessionData } from './auth.type'

// ทดลองใช้ Demo over HTTP (docs/features/demo.md rules 1–4, 9, 12).

const WEB = 'http://web.test'

const buildApp = ({
  demoEnabled = true,
  botCheck = null,
}: { demoEnabled?: boolean; botCheck?: BotCheck | null } = {}) => {
  const repo = createMemoryAuthRepository()
  const authService = createAuthService({
    authRepo: repo,
    notifier: { send: async () => undefined },
    accessTokens,
    breachChecker: skipBreachCheck,
    botCheck,
    config: {
      webOrigin: WEB,
      signupEnabled: true,
      emailDailyLimit: 100,
      startMinDurationMs: 0,
      phoneEnabled: true,
      smsDailyLimit: 100,
      demoEnabled,
    },
  })
  const app = express()
  app.use(express.json())
  app.use(cookieParser())
  app.use('/auth', createAuthRouter(createAuthController(authService, { webOrigin: WEB }), WEB))
  app.use(errorHandler)
  return { app, repo }
}

const startDemo = async (app: express.Express, lang = 'th') => {
  const res = await request(app).post('/auth/demo').send({ lang })
  const body = res.body as AppResponse<AuthSessionData>
  return { res, token: body.data?.accessToken ?? '' }
}

describe('GET /auth/providers', () => {
  it.each([true, false])('says whether the demo is on (%s)', async (demoEnabled) => {
    const res = await request(buildApp({ demoEnabled }).app).get('/auth/providers')

    expect((res.body as AppResponse<AuthProvidersData>).data?.demo).toBe(demoEnabled)
  })
})

describe('POST /auth/demo', () => {
  it('answers like a sign-in: the user, an access token and the refresh cookie', async () => {
    const { app } = buildApp()

    const { res } = await startDemo(app)

    expect(res.status).toBe(HttpStatus.OK)
    const data = (res.body as AppResponse<AuthSessionData>).data
    expect(data?.user).toMatchObject({ isDemo: true, displayName: 'ผู้ทดลองใช้' })
    expect(typeof data?.user.createdAt).toBe('string')
    expect(JSON.stringify(res.body)).not.toContain('refreshToken')
    expect(String(res.headers['set-cookie'])).toContain(`${REFRESH_COOKIE}=`)
  })

  it('is 404 DEMO_DISABLED while off, before the bot check looks at it (rule 1)', async () => {
    const verify = async () => Promise.resolve(false)
    const { app } = buildApp({ demoEnabled: false, botCheck: { siteKey: 'site', verify } })

    const res = await request(app).post('/auth/demo').send({ lang: 'th' })

    expect(res.status).toBe(HttpStatus.NOT_FOUND)
    expect((res.body as { code?: string }).code).toBe('DEMO_DISABLED')
  })

  it('is 403 BOT_CHECK_FAILED without a token the bot check accepts (rule 5)', async () => {
    const verify = async (token: string) => Promise.resolve(token === 'good')
    const { app } = buildApp({ botCheck: { siteKey: 'site', verify } })

    const refused = await request(app).post('/auth/demo').send({ lang: 'th' })
    const passed = await request(app).post('/auth/demo').send({ lang: 'th', botToken: 'good' })

    expect(refused.status).toBe(HttpStatus.FORBIDDEN)
    expect((refused.body as { code?: string }).code).toBe('BOT_CHECK_FAILED')
    expect(passed.status).toBe(HttpStatus.OK)
  })

  it('is 422 for a language it has no seed in', async () => {
    const res = await request(buildApp().app).post('/auth/demo').send({ lang: 'fr' })

    expect(res.status).toBe(HttpStatus.UNPROCESSABLE_ENTITY)
  })
})

describe('routes a demo cannot use (rule 9)', () => {
  it.each([
    ['put', '/auth/password', { newPassword: 'Gr33n Mango Tree' }],
    ['delete', '/auth/password', {}],
    ['post', '/auth/reauth/start', { lang: 'th' }],
    ['post', '/auth/phone', { phone: '0812345678' }],
    ['delete', '/auth/phone', {}],
    ['post', '/auth/google/link', {}],
    ['get', '/auth/account/deletion', undefined],
    ['delete', '/auth/account', { email: 'x@example.com' }],
  ] as const)('%s %s is 403 DEMO_NOT_ALLOWED', async (method, path, body) => {
    const { app } = buildApp()
    const { token } = await startDemo(app)

    // eslint-disable-next-line security/detect-object-injection -- a method from the table above
    const res = await request(app)[method](path).set('Authorization', `Bearer ${token}`).send(body)

    expect(res.status).toBe(HttpStatus.FORBIDDEN)
    expect((res.body as { code?: string }).code).toBe('DEMO_NOT_ALLOWED')
  })

  it('still lets a demo read and rename itself', async () => {
    const { app } = buildApp()
    const { token } = await startDemo(app)

    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${token}`)
    const renamed = await request(app)
      .patch('/auth/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ displayName: 'Recruiter' })

    expect(me.status).toBe(HttpStatus.OK)
    expect(renamed.status).toBe(HttpStatus.OK)
  })
})

describe('DELETE /auth/demo', () => {
  it('deletes the demo and drops the refresh cookie (rule 12)', async () => {
    const { app, repo } = buildApp()
    const { token } = await startDemo(app)

    const res = await request(app).delete('/auth/demo').set('Authorization', `Bearer ${token}`)

    expect(res.status).toBe(HttpStatus.OK)
    expect(String(res.headers['set-cookie'])).toContain(`${REFRESH_COOKIE}=;`)
    expect(repo.state().users).toHaveLength(0)
  })

  it('is 401 without a session', async () => {
    const res = await request(buildApp().app).delete('/auth/demo')

    expect(res.status).toBe(HttpStatus.UNAUTHORIZED)
  })
})
