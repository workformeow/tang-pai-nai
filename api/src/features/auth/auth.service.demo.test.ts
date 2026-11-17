import { describe, expect, it, vi } from 'vitest'
import type { Notification } from '@/core/notification'
import { createAccessTokens, skipBreachCheck } from '@/core/security'
import { AUTH_LIMITS, AuthErrorCode } from './auth.const'
import { createMemoryAuthRepository } from './auth.repository.memory'
import { createAuthService } from './auth.service'
import type { Caller, User } from './auth.entity'
import type { MemoryAuthState } from './auth.repository.memory'

// ทดลองใช้ Demo (docs/features/demo.md rules 1, 4–5, 9, 12–13).

const START = new Date('2026-11-17T05:00:00.000Z')
const HOUR = 3_600_000
const CLIENT = { ip: '10.0.0.1', userAgent: 'vitest' }

const accessTokens = createAccessTokens({
  secret: 'service-test-secret-service-test-secret',
  issuer: 'test-api',
  audience: 'test-web',
  ttlSeconds: 600,
})

const user = (overrides: Partial<User>): User => ({
  id: '01900000-0000-7000-8000-000000000001',
  email: 'someone@example.com',
  displayName: 'someone',
  avatarUrl: null,
  emailVerifiedAt: START,
  phone: null,
  phoneVerifiedAt: null,
  status: 'active',
  timezone: 'Asia/Bangkok',
  isDemo: false,
  createdAt: START,
  updatedAt: START,
  ...overrides,
})

const setup = ({
  demoEnabled = true,
  seed,
}: { demoEnabled?: boolean; seed?: Partial<MemoryAuthState> } = {}) => {
  const repo = createMemoryAuthRepository(seed)
  const clock = { now: START }
  const sent: Notification[] = []
  const service = createAuthService({
    authRepo: repo,
    notifier: {
      send: vi.fn(async (notification: Notification) => {
        sent.push(notification)
      }),
    },
    accessTokens,
    breachChecker: skipBreachCheck,
    config: {
      webOrigin: 'http://web.test',
      signupEnabled: true,
      emailDailyLimit: 100,
      phoneEnabled: true,
      smsDailyLimit: 100,
      startMinDurationMs: 0,
      demoEnabled,
    },
    now: () => clock.now,
  })
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms)
  }
  return { service, repo, sent, advance }
}

const callerOf = async (accessToken: string): Promise<Caller> => {
  const claims = await accessTokens.verify(accessToken)
  if (!claims) {
    throw new Error('invalid access token')
  }
  return { userId: claims.sub, sessionFamilyId: claims.sid }
}

describe('demoEnabled', () => {
  it('follows DEMO_ENABLED, off when it is not set (rule 1)', () => {
    expect(setup().service.demoEnabled).toBe(true)
    expect(setup({ demoEnabled: false }).service.demoEnabled).toBe(false)
  })
})

describe('startDemo', () => {
  it('is 404 DEMO_DISABLED while the demo is off, and makes nothing', async () => {
    const ctx = setup({ demoEnabled: false })

    await expect(ctx.service.startDemo('th', CLIENT)).rejects.toMatchObject({
      status: 404,
      code: AuthErrorCode.DEMO_DISABLED,
    })
    expect(ctx.repo.state().users).toHaveLength(0)
  })

  it('makes a demo user with a placeholder address, its seed and a session (rule 4)', async () => {
    const ctx = setup()

    const result = await ctx.service.startDemo('th', CLIENT)

    expect(result.user).toMatchObject({ displayName: 'ผู้ทดลองใช้', isDemo: true })
    expect(result.user.email).toMatch(/^demo-[0-9a-f-]{36}@demo\.invalid$/)
    expect(result.refreshToken).not.toBe('')
    const seed = ctx.repo.state().demoSeeds.get(result.user.id)
    expect(seed?.book.name).toBe('ส่วนตัว')
    // Rule 7: dated from today in the user's time zone (Bangkok: still the 17th at 05:00 UTC).
    expect(seed?.transactions.some((t) => t.occurredOn === '2026-11-17')).toBe(true)
    expect(ctx.repo.state().sessions).toHaveLength(1)
    await expect(callerOf(result.accessToken)).resolves.toMatchObject({ userId: result.user.id })
  })

  it('names the user and the seed in the language asked', async () => {
    const ctx = setup()

    const result = await ctx.service.startDemo('en', CLIENT)

    expect(result.user.displayName).toBe('Demo user')
    expect(ctx.repo.state().demoSeeds.get(result.user.id)?.book.name).toBe('Personal')
  })

  it('allows 5 demos per IP per hour, then 429 RATE_LIMITED (rule 5)', async () => {
    const ctx = setup()
    for (let i = 0; i < 5; i++) {
      await ctx.service.startDemo('th', CLIENT)
    }

    await expect(ctx.service.startDemo('th', CLIENT)).rejects.toMatchObject({
      status: 429,
      code: AuthErrorCode.RATE_LIMITED,
    })
    await expect(ctx.service.startDemo('th', { ip: '10.0.0.2' })).resolves.toBeDefined()
    ctx.advance(HOUR)
    await expect(ctx.service.startDemo('th', CLIENT)).resolves.toBeDefined()
  })

  it('leaves nothing behind when a step fails (one transaction)', async () => {
    const ctx = setup()
    const failing = vi.spyOn(ctx.repo, 'seedDemo').mockRejectedValueOnce(new Error('disk full'))

    await expect(ctx.service.startDemo('th', CLIENT)).rejects.toThrow('disk full')

    expect(failing).toHaveBeenCalledOnce()
    expect(ctx.repo.state().users).toHaveLength(0)
    expect(ctx.repo.state().sessions).toHaveLength(0)
  })
})

describe('endDemo', () => {
  it('deletes the demo at once, with no mail (rule 12)', async () => {
    const ctx = setup()
    const started = await ctx.service.startDemo('th', CLIENT)

    await ctx.service.endDemo(await callerOf(started.accessToken))

    expect(ctx.repo.state().users).toHaveLength(0)
    expect(ctx.repo.state().demoSeeds.size).toBe(0)
    expect(ctx.repo.state().sessions).toHaveLength(0)
    expect(ctx.sent).toHaveLength(0)
  })

  it('is 403 NOT_DEMO for an account that is not a demo', async () => {
    const ctx = setup({ seed: { users: [user({})] } })
    await ctx.service.startEmailSignIn('someone@example.com', 'th', CLIENT)
    const code = /^ {4}(\d{6})$/m.exec(ctx.sent.at(-1)?.text ?? '')?.[1] ?? ''
    const signedIn = await ctx.service.verifyEmailSignIn(
      { email: 'someone@example.com', code },
      CLIENT
    )

    await expect(ctx.service.endDemo(await callerOf(signedIn.accessToken))).rejects.toMatchObject({
      status: 403,
      code: AuthErrorCode.NOT_DEMO,
    })
    expect(ctx.repo.state().users).toHaveLength(1)
  })
})

describe('isDemo', () => {
  it('says whether the user is a demo; an unknown user is not', async () => {
    const ctx = setup({
      seed: {
        users: [user({}), user({ id: 'demo-1', email: 'demo-1@demo.invalid', isDemo: true })],
      },
    })

    await expect(ctx.service.isDemo('demo-1')).resolves.toBe(true)
    await expect(ctx.service.isDemo(user({}).id)).resolves.toBe(false)
    await expect(ctx.service.isDemo('nobody')).resolves.toBe(false)
  })
})

describe('startEmailSignIn for a demo address', () => {
  it('sends no mail to a demo’s placeholder address (rule 9)', async () => {
    const ctx = setup({
      seed: { users: [user({ id: 'demo-1', email: 'demo-1@demo.invalid', isDemo: true })] },
    })

    await ctx.service.startEmailSignIn('demo-1@demo.invalid', 'th', CLIENT)

    expect(ctx.sent).toHaveLength(0)
  })
})

describe('cleanup', () => {
  it('deletes demos created more than 24 hours ago, and only demos (rule 13)', async () => {
    const old = new Date(START.getTime() - AUTH_LIMITS.DEMO_LIFETIME_MS - 1)
    const ctx = setup({
      seed: {
        users: [
          user({ createdAt: old }),
          user({ id: 'demo-old', email: 'a@demo.invalid', isDemo: true, createdAt: old }),
          user({ id: 'demo-new', email: 'b@demo.invalid', isDemo: true, createdAt: START }),
        ],
      },
    })

    const removed = await ctx.service.cleanup()

    expect(removed.demoUsers).toBe(1)
    expect(ctx.repo.state().users.map((u) => u.id)).toEqual([user({}).id, 'demo-new'])
  })
})
