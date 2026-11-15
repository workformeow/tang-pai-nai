import { describe, expect, it, vi } from 'vitest'
import type { Notification } from '@/core/notification'
import { createAccessTokens, skipBreachCheck } from '@/core/security'
import { NotificationChannel } from '@/shared/types'
import { AUTH_LIMITS, AuthErrorCode } from './auth.const'
import { buildAccountDeletedMail } from './auth.mail'
import { createMemoryAuthRepository } from './auth.repository.memory'
import { createAuthService } from './auth.service'
import type { Caller } from './auth.entity'

// Privacy notice and account deletion (privacy spec rules 2, 6–10, part #22).

const START = new Date('2026-11-15T00:00:00.000Z')
const MINUTE = 60_000
const EMAIL = 'friend@example.com'
const CLIENT = { ip: '10.0.0.1', userAgent: 'vitest' }
const PASSWORD = 'Gr33n Mango Tree'

const accessTokens = createAccessTokens({
  secret: 'service-test-secret-service-test-secret',
  issuer: 'test-api',
  audience: 'test-web',
  ttlSeconds: 600,
})

const setup = ({ testVersion = false, failSend = false } = {}) => {
  const repo = createMemoryAuthRepository()
  const clock = { now: START }
  const sent: Notification[] = []
  const send = vi.fn(async (notification: Notification) => {
    if (failSend && notification.channel === NotificationChannel.EMAIL) {
      if (notification.subject.includes('ลบบัญชี')) {
        throw new Error('smtp down')
      }
    }
    sent.push(notification)
  })
  const service = createAuthService({
    authRepo: repo,
    notifier: { send },
    accessTokens,
    breachChecker: skipBreachCheck,
    config: {
      webOrigin: 'http://web.test',
      signupEnabled: true,
      emailDailyLimit: 100,
      phoneEnabled: true,
      smsDailyLimit: 100,
      startMinDurationMs: 0,
      testVersion,
    },
    now: () => clock.now,
  })
  const advance = (ms: number) => {
    clock.now = new Date(clock.now.getTime() + ms)
  }
  const mails = () =>
    sent.flatMap((notification) =>
      notification.channel === NotificationChannel.EMAIL ? [notification] : []
    )
  const lastCode = () => /^ {4}(\d{6})$/m.exec(mails().at(-1)?.text ?? '')?.[1] ?? ''
  return { service, repo, advance, mails, lastCode }
}
type Ctx = ReturnType<typeof setup>

const signIn = async (ctx: Ctx, email = EMAIL): Promise<Caller> => {
  ctx.advance(MINUTE)
  await ctx.service.startEmailSignIn(email, 'th', CLIENT)
  const session = await ctx.service.verifyEmailSignIn({ email, code: ctx.lastCode() }, CLIENT)
  const claims = await accessTokens.verify(session.accessToken)
  if (!claims) {
    throw new Error('invalid access token')
  }
  return { userId: claims.sub, sessionFamilyId: claims.sid }
}

const goStale = (ctx: Ctx) => ctx.advance(AUTH_LIMITS.RECENT_AUTH_MS + 1)

describe('testVersion', () => {
  it('follows TEST_VERSION, off when it is not set', () => {
    expect(setup({ testVersion: true }).service.testVersion).toBe(true)
    expect(setup().service.testVersion).toBe(false)
  })
})

describe('deletionSummary', () => {
  it('answers how many people the shared wallets reach (none in the memory adapter)', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    await expect(ctx.service.deletionSummary(caller)).resolves.toEqual({ sharedWith: 0 })
  })
})

describe('deleteAccount', () => {
  it('deletes the user, their sessions and their sign-in codes at once, then mails it', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    // Another user's code must stay.
    await ctx.service.startEmailSignIn('other@example.com', 'th', CLIENT)

    await ctx.service.deleteAccount(caller, { email: EMAIL, lang: 'en' }, CLIENT)

    const state = ctx.repo.state()
    expect(state.users.map((user) => user.email)).toEqual([])
    expect(state.sessions).toEqual([])
    expect(state.challenges.map((challenge) => challenge.destination)).toEqual([
      'other@example.com',
    ])
    const mail = ctx.mails().at(-1)
    expect(mail?.to).toBe(EMAIL)
    expect(mail?.subject).toBe(`Your Tang Pai Nai account was deleted: ${EMAIL}`)
  })

  it('takes the typed email trimmed and in any case', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    await ctx.service.deleteAccount(caller, { email: `  ${EMAIL.toUpperCase()} ` }, CLIENT)
    expect(ctx.repo.state().users).toEqual([])
  })

  it('refuses another email before asking for proof, and deletes nothing', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    goStale(ctx)
    await expect(
      ctx.service.deleteAccount(caller, { email: 'someone@example.com' }, CLIENT)
    ).rejects.toMatchObject({ code: AuthErrorCode.ACCOUNT_EMAIL_MISMATCH })
    expect(ctx.repo.state().users).toHaveLength(1)
  })

  it('needs recent auth: a sign-in over 10 minutes ago asks for proof first', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    goStale(ctx)
    await expect(ctx.service.deleteAccount(caller, { email: EMAIL }, CLIENT)).rejects.toMatchObject(
      { code: AuthErrorCode.REAUTH_REQUIRED }
    )
    expect(ctx.repo.state().users).toHaveLength(1)
  })

  it('takes the current password as the proof', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    await ctx.service.setPassword(caller, { newPassword: PASSWORD }, CLIENT)
    goStale(ctx)
    await ctx.service.deleteAccount(caller, { email: EMAIL, currentPassword: PASSWORD }, CLIENT)
    expect(ctx.repo.state().users).toEqual([])
    expect(ctx.repo.state().passwords.size).toBe(0)
  })

  it('takes a step-up code as the proof', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    goStale(ctx)
    await ctx.service.startReauth(caller, 'th', CLIENT)
    await ctx.service.verifyReauth(caller, ctx.lastCode(), CLIENT)
    await ctx.service.deleteAccount(caller, { email: EMAIL }, CLIENT)
    expect(ctx.repo.state().users).toEqual([])
  })

  it('still deletes when the mail fails to send', async () => {
    const ctx = setup({ failSend: true })
    const caller = await signIn(ctx)
    await ctx.service.deleteAccount(caller, { email: EMAIL }, CLIENT)
    expect(ctx.repo.state().users).toEqual([])
  })

  it('refuses a caller whose session is gone, then signing in again starts a new account', async () => {
    const ctx = setup()
    const caller = await signIn(ctx)
    await ctx.service.deleteAccount(caller, { email: EMAIL }, CLIENT)
    await expect(ctx.service.deleteAccount(caller, { email: EMAIL }, CLIENT)).rejects.toThrow()

    const again = await signIn(ctx)
    expect(again.userId).not.toBe(caller.userId)
  })
})

describe('buildAccountDeletedMail', () => {
  it('says it is gone, in the user’s language, with no link', () => {
    const at = new Date('2026-11-15T07:30:00.000Z')
    const th = buildAccountDeletedMail({ email: EMAIL, lang: 'th', at, timeZone: 'Asia/Bangkok' })
    expect(th.subject).toBe(`ลบบัญชี ตังค์ไปไหน แล้ว: ${EMAIL}`)
    expect(th.text).toContain('14:30')
    expect(th.text).not.toMatch(/https?:\/\//)
    const en = buildAccountDeletedMail({ email: EMAIL, lang: 'en', at, timeZone: 'Asia/Bangkok' })
    expect(en.text).toContain('starts a new, empty account')
  })
})
