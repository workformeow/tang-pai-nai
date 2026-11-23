import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { env } from '@/core/config'
import { createDatabase } from '@/core/database/client'
import { demoRowCount } from '@/core/database/demo-rows'
import {
  categories,
  books,
  sessions,
  transactions,
  users,
  walletInvites,
  walletMembers,
  wallets,
} from '@/core/database/schema'
import { makeTempDir, removeTempDir } from '@/shared/testing/temp-dir'
import { buildDemoSeed, demoSeedSize } from './auth.demo-seed'
import { createDrizzleAuthRepository } from './auth.repository.drizzle'
import type { AuthRepository } from './auth.repository'

const AT = new Date('2026-10-19T00:00:00.000Z')
const later = (ms: number) => new Date(AT.getTime() + ms)

// A real SQLite file per test with the committed migrations (`:memory:` gives each
// transaction its own empty database), so the SQL itself is under test.
let dir: string
let close: () => void
let repo: AuthRepository
let database: ReturnType<typeof createDatabase>['db']

beforeEach(async () => {
  dir = makeTempDir('auth')
  const { client, db } = createDatabase({ ...env, DATABASE_URL: `file:${join(dir, 'test.db')}` })
  await migrate(db, { migrationsFolder: 'drizzle' })
  repo = createDrizzleAuthRepository(db)
  database = db
  close = () => client.close()
})

afterEach(() => {
  close()
  removeTempDir(dir)
})

const newChallenge = async (destination = 'a@example.com', expiresAt = later(600_000)) =>
  repo.createChallenge({
    purpose: 'sign_in',
    destination,
    userId: null,
    codeHash: 'c',
    linkTokenHash: `l-${Math.random()}`,
    expiresAt,
  })

const newSession = async (overrides: { id: string; familyId: string; tokenHash: string }) => {
  const user =
    (await repo.findUserByEmail('a@example.com')) ??
    (await repo.createUser({ email: 'a@example.com', displayName: 'a' }))
  return repo.createSession({
    ...overrides,
    userId: user.id,
    expiresAt: later(1000),
    absoluteExpiresAt: later(2000),
    authTime: AT,
    signedInAt: AT,
    lastUsedAt: AT,
    userAgent: null,
  })
}

describe('hitRateLimit', () => {
  it('counts hits within the window and starts over after it', async () => {
    expect(await repo.hitRateLimit('k', 60_000, AT)).toEqual({ count: 1, windowStart: AT })
    expect(await repo.hitRateLimit('k', 60_000, later(30_000))).toEqual({
      count: 2,
      windowStart: AT,
    })
    expect(await repo.hitRateLimit('k', 60_000, later(60_000))).toEqual({
      count: 1,
      windowStart: later(60_000),
    })
  })

  it('keeps separate keys apart', async () => {
    await repo.hitRateLimit('a', 60_000, AT)

    expect((await repo.hitRateLimit('b', 60_000, AT)).count).toBe(1)
  })
})

describe('challenges', () => {
  it('finds the newest challenge and expires only open ones', async () => {
    const old = await newChallenge()
    const latest = await newChallenge()
    await repo.consumeChallenge(old.id, AT)

    await repo.expireOpenChallenges('a@example.com', 'sign_in', later(1))

    expect((await repo.findLatestChallenge('a@example.com', 'sign_in'))?.id).toBe(latest.id)
    expect((await repo.findLatestChallenge('a@example.com', 'sign_in'))?.expiresAt).toEqual(
      later(1)
    )
  })

  it('consumes a challenge once and counts failed attempts', async () => {
    const challenge = await newChallenge()

    expect(await repo.recordFailedAttempt(challenge.id)).toBe(1)
    expect(await repo.recordFailedAttempt(challenge.id)).toBe(2)
    expect(await repo.consumeChallenge(challenge.id, AT)).toBe(true)
    expect(await repo.consumeChallenge(challenge.id, AT)).toBe(false)
    expect(await repo.recordFailedAttempt('missing')).toBeNull()
  })
})

describe('sessions', () => {
  it('rotates a session once and revokes a whole family', async () => {
    await newSession({ id: 's1', familyId: 'f', tokenHash: 'h1' })
    await newSession({ id: 's2', familyId: 'f', tokenHash: 'h2' })

    expect(await repo.markSessionRotated('s1', 's2', AT)).toBe(true)
    expect(await repo.markSessionRotated('s1', 's3', AT)).toBe(false)
    expect(await repo.revokeFamily('f', AT)).toBe(1)
    expect((await repo.findSessionByTokenHash('h2'))?.revokedAt).toEqual(AT)
  })
})

describe('transaction', () => {
  it('rolls back every write when the work throws', async () => {
    await expect(
      repo.transaction(async (tx) => {
        await tx.createUser({ email: 'rollback@example.com', displayName: 'r' })
        throw new Error('boom')
      })
    ).rejects.toThrow()

    expect(await repo.findUserByEmail('rollback@example.com')).toBeNull()
  })
})

describe('deleteExpired', () => {
  it('removes rows that ended before the cutoff and keeps the rest', async () => {
    await newChallenge('old@example.com', later(-10))
    await newChallenge('new@example.com', later(10))
    await newSession({ id: 's1', familyId: 'f', tokenHash: 'h1' })
    await repo.hitRateLimit('k', 60_000, AT)
    const owner = await repo.createUser({ email: 'owner@example.com', displayName: 'o' })
    await database.insert(books).values({
      id: 'pa',
      userId: owner.id,
      name: 'pa',
      icon: 'lucideHouse',
      color: '#000',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      changeSeq: 1,
      updatedBy: 'device',
    })
    const invite = (id: string, email: string, expiresAt: Date) => ({
      id,
      bookId: 'pa',
      ownerId: owner.id,
      email,
      role: 'viewer' as const,
      walletIds: [],
      createdAt: 1,
      expiresAt: expiresAt.getTime(),
      lastSentAt: 1,
    })
    await database
      .insert(walletInvites)
      .values([
        invite('00000000-0000-7000-8000-0000000000e1', 'old@example.com', later(-10)),
        invite('00000000-0000-7000-8000-0000000000e2', 'new@example.com', later(10_000)),
      ])

    const removed = await repo.deleteExpired(later(5000))

    expect(removed).toEqual({ challenges: 2, sessions: 1, rateLimitBuckets: 1, invites: 1 })
    expect((await database.select().from(walletInvites)).map((row) => row.email)).toEqual([
      'new@example.com',
    ])
    expect(await repo.deleteExpired(AT)).toEqual({
      challenges: 0,
      sessions: 0,
      rateLimitBuckets: 0,
      invites: 0,
    })
  })
})

describe('password hashes', () => {
  it('creates, replaces, reads and deletes the one row of a user', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })

    expect(await repo.findPasswordHash(user.id)).toBeNull()
    await repo.savePasswordHash(user.id, '$argon2id$one', AT)
    await repo.savePasswordHash(user.id, '$argon2id$two', later(1))
    expect(await repo.findPasswordHash(user.id)).toBe('$argon2id$two')
    expect(await repo.deletePasswordHash(user.id)).toBe(true)
    expect(await repo.deletePasswordHash(user.id)).toBe(false)
    expect(await repo.findPasswordHash(user.id)).toBeNull()
  })
})

describe('challenge purposes', () => {
  it('keeps sign-in and step-up challenges of one email apart', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    const signIn = await newChallenge()
    const reauth = await repo.createChallenge({
      purpose: 'reauth',
      destination: 'a@example.com',
      userId: user.id,
      codeHash: 'r',
      linkTokenHash: null,
      expiresAt: later(600_000),
    })

    await repo.expireOpenChallenges('a@example.com', 'reauth', later(1))

    expect((await repo.findLatestChallenge('a@example.com', 'sign_in'))?.expiresAt).toEqual(
      signIn.expiresAt
    )
    expect(await repo.findLatestChallenge('a@example.com', 'reauth')).toMatchObject({
      id: reauth.id,
      purpose: 'reauth',
      userId: user.id,
      expiresAt: later(1),
    })
  })
})

describe('session families', () => {
  it('finds the newest session of a family that is not revoked', async () => {
    await newSession({ id: 's1', familyId: 'f1', tokenHash: 't1' })
    await repo.markSessionRotated('s1', 's2', AT)
    await newSession({ id: 's2', familyId: 'f1', tokenHash: 't2' })

    expect((await repo.findActiveSession('f1'))?.id).toBe('s2')
    await repo.revokeFamily('f1', AT)
    expect(await repo.findActiveSession('f1')).toBeNull()
  })

  it('moves authTime only on the family’s sessions that are not revoked', async () => {
    await newSession({ id: 's1', familyId: 'f1', tokenHash: 't1' })
    await repo.markSessionRotated('s1', 's2', AT)
    await newSession({ id: 's2', familyId: 'f1', tokenHash: 't2' })

    await repo.setFamilyAuthTime('f1', later(5000))

    expect((await repo.findSessionByTokenHash('t1'))?.authTime).toEqual(AT)
    expect((await repo.findSessionByTokenHash('t2'))?.authTime).toEqual(later(5000))
  })

  it('revokes every other family of the user and nobody else’s', async () => {
    await newSession({ id: 's1', familyId: 'keep', tokenHash: 't1' })
    await newSession({ id: 's2', familyId: 'other', tokenHash: 't2' })
    const stranger = await repo.createUser({ email: 'b@example.com', displayName: 'b' })
    await repo.createSession({
      id: 's3',
      familyId: 'theirs',
      tokenHash: 't3',
      userId: stranger.id,
      expiresAt: later(1000),
      absoluteExpiresAt: later(2000),
      authTime: AT,
      signedInAt: AT,
      lastUsedAt: AT,
      userAgent: null,
    })
    const user = await repo.findUserByEmail('a@example.com')

    expect(await repo.revokeOtherFamilies(user?.id ?? '', 'keep', later(1))).toBe(1)
    expect((await repo.findSessionByTokenHash('t1'))?.revokedAt).toBeNull()
    expect((await repo.findSessionByTokenHash('t2'))?.revokedAt).toEqual(later(1))
    expect((await repo.findSessionByTokenHash('t3'))?.revokedAt).toBeNull()
  })
})

describe('peekRateLimit', () => {
  it('reads the running window without counting, and nothing once it ended', async () => {
    expect(await repo.peekRateLimit('k', 60_000, AT)).toBeNull()
    await repo.hitRateLimit('k', 60_000, AT)
    await repo.hitRateLimit('k', 60_000, AT)

    expect(await repo.peekRateLimit('k', 60_000, later(1))).toEqual({ count: 2, windowStart: AT })
    expect(await repo.peekRateLimit('k', 60_000, later(1))).toEqual({ count: 2, windowStart: AT })
    expect(await repo.peekRateLimit('k', 60_000, later(60_000))).toBeNull()
  })
})

describe('identities', () => {
  it('creates, finds by provider + sub, lists and touches an identity', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })

    const created = await repo.createIdentity({
      userId: user.id,
      provider: 'google',
      providerSubject: 'sub-1',
      emailAtLink: 'a@gmail.com',
      lastUsedAt: AT,
    })
    await repo.touchIdentity(created.id, later(5000))

    expect(await repo.findIdentity('google', 'sub-2')).toBeNull()
    expect(await repo.findIdentity('google', 'sub-1')).toMatchObject({
      id: created.id,
      userId: user.id,
      emailAtLink: 'a@gmail.com',
      lastUsedAt: later(5000),
    })
    expect(await repo.listIdentities(user.id)).toHaveLength(1)
    expect(await repo.listIdentities('someone-else')).toEqual([])
  })

  it('refuses a second link of the same provider account', async () => {
    const one = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    const two = await repo.createUser({ email: 'b@example.com', displayName: 'b' })
    const link = {
      provider: 'google' as const,
      providerSubject: 'sub-1',
      emailAtLink: 'a@gmail.com',
      lastUsedAt: AT,
    }
    await repo.createIdentity({ ...link, userId: one.id })

    await expect(repo.createIdentity({ ...link, userId: two.id })).rejects.toMatchObject({
      status: 500,
    })
  })

  it('goes away with its user', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    await repo.createIdentity({
      userId: user.id,
      provider: 'google',
      providerSubject: 'sub-1',
      emailAtLink: 'a@gmail.com',
      lastUsedAt: AT,
    })

    await database.delete(users).where(eq(users.id, user.id))

    expect(await repo.findIdentity('google', 'sub-1')).toBeNull()
  })
})

describe('fillAvatarIfEmpty', () => {
  it('sets a missing avatar and leaves one that is there', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })

    expect(await repo.fillAvatarIfEmpty(user.id, 'https://x.test/1.png')).toMatchObject({
      avatarUrl: 'https://x.test/1.png',
    })
    expect(await repo.fillAvatarIfEmpty(user.id, 'https://x.test/2.png')).toMatchObject({
      avatarUrl: 'https://x.test/1.png',
    })
    expect(await repo.fillAvatarIfEmpty('missing', 'https://x.test/3.png')).toBeNull()
  })

  it('creates a user with an avatar when one is given', async () => {
    const user = await repo.createUser({
      email: 'a@example.com',
      displayName: 'a',
      avatarUrl: 'https://x.test/a.png',
    })

    expect(user.avatarUrl).toBe('https://x.test/a.png')
  })
})

describe('setDisplayName', () => {
  it('saves the name and the time, and answers null for a missing user', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    const at = new Date('2026-11-16T10:00:00Z')

    expect(await repo.setDisplayName(user.id, 'สมชาย ใจดี', at)).toMatchObject({
      displayName: 'สมชาย ใจดี',
      updatedAt: at,
    })
    expect(await repo.findUserById(user.id)).toMatchObject({ displayName: 'สมชาย ใจดี' })
    expect(await repo.setDisplayName('missing', 'x', at)).toBeNull()
  })
})

describe('identity per user (4.4a)', () => {
  it('finds and deletes the user’s identity of one provider, nobody else’s', async () => {
    const one = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    const two = await repo.createUser({ email: 'b@example.com', displayName: 'b' })
    const link = { provider: 'google' as const, emailAtLink: 'x@gmail.com', lastUsedAt: AT }
    await repo.createIdentity({ ...link, userId: one.id, providerSubject: 'sub-1' })
    await repo.createIdentity({ ...link, userId: two.id, providerSubject: 'sub-2' })

    expect(await repo.findUserIdentity(one.id, 'google')).toMatchObject({
      providerSubject: 'sub-1',
    })
    expect(await repo.deleteIdentity(one.id, 'google')).toBe(true)
    expect(await repo.deleteIdentity(one.id, 'google')).toBe(false)
    expect(await repo.findUserIdentity(one.id, 'google')).toBeNull()
    expect(await repo.findUserIdentity(two.id, 'google')).toMatchObject({
      providerSubject: 'sub-2',
    })
  })
})

describe('listActiveSessions', () => {
  it('lists the user’s live sessions, the last used first, with signedInAt kept', async () => {
    const recent = await newSession({ id: 's1', familyId: 'f1', tokenHash: 't1' })
    const older = await newSession({ id: 's2', familyId: 'f2', tokenHash: 't2' })
    await newSession({ id: 's3', familyId: 'f3', tokenHash: 't3' })
    await repo.revokeFamily('f3', AT)
    await database
      .update(sessions)
      .set({ lastUsedAt: later(500) })
      .where(eq(sessions.id, 's1'))
    const stranger = await repo.createUser({ email: 'b@example.com', displayName: 'b' })
    await repo.createSession({
      id: 's4',
      familyId: 'f4',
      tokenHash: 't4',
      userId: stranger.id,
      expiresAt: later(1000),
      absoluteExpiresAt: later(2000),
      authTime: AT,
      signedInAt: AT,
      lastUsedAt: later(900),
      userAgent: null,
    })

    const live = await repo.listActiveSessions(recent.userId, later(1))

    expect(live.map((session) => session.id)).toEqual([recent.id, older.id])
    expect(live[0].signedInAt).toEqual(AT)
    // Past the idle expiry nothing is live.
    expect(await repo.listActiveSessions(recent.userId, later(1000))).toEqual([])
  })
})

describe('phone (4.4b)', () => {
  it('finds a user by verified number and sets or clears it with its time', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    expect(await repo.findUserByPhone('+66812345678')).toBeNull()

    const saved = await repo.setUserPhone(user.id, '+66812345678', AT)
    expect(saved).toMatchObject({ phone: '+66812345678', phoneVerifiedAt: AT })
    expect((await repo.findUserByPhone('+66812345678'))?.id).toBe(user.id)

    const cleared = await repo.setUserPhone(user.id, null, later(1))
    expect(cleared).toMatchObject({ phone: null, phoneVerifiedAt: null })
    expect(await repo.setUserPhone('01900000-0000-7000-8000-00000000dead', null, AT)).toBeNull()
  })

  it('keeps a number unique across users', async () => {
    const a = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    const b = await repo.createUser({ email: 'b@example.com', displayName: 'b' })
    await repo.setUserPhone(a.id, '+66812345678', AT)

    await expect(repo.setUserPhone(b.id, '+66812345678', AT)).rejects.toMatchObject({
      status: 500,
    })
  })

  it('keeps sms and email challenges apart and finds a user’s verify_phone code', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })
    const sms = await repo.createChallenge({
      channel: 'sms',
      purpose: 'sign_in',
      destination: '+66812345678',
      userId: null,
      codeHash: 'c',
      linkTokenHash: null,
      expiresAt: later(300_000),
    })
    const verify = await repo.createChallenge({
      channel: 'sms',
      purpose: 'verify_phone',
      destination: '+66898765432',
      userId: user.id,
      codeHash: 'v',
      linkTokenHash: null,
      expiresAt: later(300_000),
    })

    expect(await repo.findLatestChallenge('+66812345678', 'sign_in')).toBeNull()
    expect(await repo.findLatestChallenge('+66812345678', 'sign_in', 'sms')).toMatchObject({
      id: sms.id,
      channel: 'sms',
    })
    expect(await repo.findLatestUserChallenge(user.id, 'verify_phone')).toMatchObject({
      id: verify.id,
      purpose: 'verify_phone',
      destination: '+66898765432',
    })

    await repo.expireOpenUserChallenges(user.id, 'verify_phone', later(1))
    await repo.expireOpenChallenges('+66812345678', 'sign_in', later(2), 'sms')
    expect((await repo.findLatestUserChallenge(user.id, 'verify_phone'))?.expiresAt).toEqual(
      later(1)
    )
    expect((await repo.findLatestChallenge('+66812345678', 'sign_in', 'sms'))?.expiresAt).toEqual(
      later(2)
    )
  })
})

describe('deleting an account (privacy rules 8, 10)', () => {
  const sync = { createdAt: 1, updatedAt: 1, deletedAt: null, changeSeq: 1, updatedBy: 'device' }
  const book = (id: string, userId: string) => ({
    id,
    userId,
    name: id,
    icon: 'lucideHouse',
    color: '#000',
    sortOrder: 0,
    ...sync,
  })
  const wallet = (id: string, bookId: string, userId: string, extra = {}) => ({
    id,
    userId,
    bookId,
    name: id,
    currencyCode: 'THB',
    initialBalance: 0,
    icon: 'lucideWallet',
    color: '#000',
    excludeFromTotal: false,
    isArchived: false,
    sortOrder: 0,
    ...sync,
    ...extra,
  })

  /** Alice owns a book with two wallets shared with Bob and Carol; she is a member of Bob's. */
  const seed = async () => {
    const alice = await repo.createUser({ email: 'alice@example.com', displayName: 'Alice' })
    const bob = await repo.createUser({ email: 'bob@example.com', displayName: 'Bob' })
    const carol = await repo.createUser({ email: 'carol@example.com', displayName: 'Carol' })
    await database.insert(books).values([book('pa', alice.id), book('pb', bob.id)])
    await database
      .insert(wallets)
      .values([
        wallet('home', 'pa', alice.id),
        wallet('cash', 'pa', alice.id),
        wallet('gone', 'pa', alice.id, { deletedAt: 5 }),
        wallet('bobs', 'pb', bob.id),
      ])
    const member = (walletId: string, userId: string) => ({
      walletId,
      userId,
      role: 'editor' as const,
      addedAt: 1,
    })
    await database
      .insert(walletMembers)
      .values([
        member('home', bob.id),
        member('cash', bob.id),
        member('cash', carol.id),
        member('gone', carol.id),
        member('bobs', alice.id),
      ])
    await database.insert(categories).values({
      id: 'food',
      userId: alice.id,
      bookId: 'pa',
      type: 'expense',
      parentId: null,
      name: 'Food',
      icon: 'lucideUtensils',
      color: '#000',
      isArchived: false,
      sortOrder: 0,
      ...sync,
    })
    await database.insert(transactions).values({
      id: 't1',
      userId: alice.id,
      bookId: 'pa',
      walletId: 'home',
      categoryId: 'food',
      amount: 100,
      occurredOn: '2026-11-01',
      note: '',
      excludeFromReport: false,
      ...sync,
    })
    const invite = (id: string, email: string) => ({
      id,
      bookId: 'pb',
      ownerId: bob.id,
      email,
      role: 'viewer' as const,
      walletIds: ['bobs'],
      createdAt: 1,
      expiresAt: later(1000).getTime(),
      lastSentAt: 1,
    })
    await database
      .insert(walletInvites)
      .values([
        invite('00000000-0000-7000-8000-0000000000f1', 'alice@example.com'),
        invite('00000000-0000-7000-8000-0000000000f2', 'carol@example.com'),
      ])
    await newChallenge('alice@example.com')
    await newChallenge('bob@example.com')
    return { alice, bob, carol }
  }

  it('counts each person the live wallets are shared with once', async () => {
    const { alice, bob } = await seed()
    await expect(repo.countSharedPeople(alice.id)).resolves.toBe(2)
    await expect(repo.countSharedPeople(bob.id)).resolves.toBe(1)
  })

  it('takes everything of the user with it, and leaves everyone else’s', async () => {
    const { alice, bob } = await seed()

    await expect(
      repo.transaction(async (tx) => tx.deleteUser(alice.id, alice.email))
    ).resolves.toBe(true)

    const left = async <T extends { id: string }>(rows: Promise<T[]>) =>
      (await rows).map((row) => row.id).sort()
    await expect(left(database.select().from(users))).resolves.toEqual(
      [bob.id, (await repo.findUserByEmail('carol@example.com'))?.id ?? ''].sort()
    )
    await expect(left(database.select().from(books))).resolves.toEqual(['pb'])
    await expect(left(database.select().from(wallets))).resolves.toEqual(['bobs'])
    await expect(left(database.select().from(transactions))).resolves.toEqual([])
    await expect(left(database.select().from(categories))).resolves.toEqual([])
    const members = await database.select().from(walletMembers)
    expect(members).toEqual([])
    const invites = await database.select().from(walletInvites)
    expect(invites.map((invite) => invite.email)).toEqual(['carol@example.com'])
    await expect(repo.findLatestChallenge('alice@example.com', 'sign_in')).resolves.toBeNull()
    await expect(repo.findLatestChallenge('bob@example.com', 'sign_in')).resolves.not.toBeNull()
  })

  it('answers false for a user already gone', async () => {
    await expect(repo.deleteUser('nobody', 'nobody@example.com')).resolves.toBe(false)
  })
})

describe('demo (docs/features/demo.md rules 4, 11, 13)', () => {
  const seedFor = (today = '2026-11-17') =>
    buildDemoSeed({ lang: 'th', today, now: Date.parse(`${today}T05:00:00.000Z`) })

  const newDemo = async (email = 'demo-1@demo.invalid') =>
    repo.createUser({ email, displayName: 'ผู้ทดลองใช้', isDemo: true })

  it('makes a demo user (isDemo stored)', async () => {
    const user = await newDemo()

    expect(user.isDemo).toBe(true)
    expect((await repo.findUserById(user.id))?.isDemo).toBe(true)
    expect((await repo.createUser({ email: 'a@example.com', displayName: 'a' })).isDemo).toBe(false)
  })

  it('writes every seed row as the user’s own, each with a changeSeq of its own', async () => {
    const user = await newDemo()
    const seed = seedFor()

    await repo.seedDemo(user.id, seed, AT)

    const written = await database
      .select()
      .from(transactions)
      .where(eq(transactions.userId, user.id))
    expect(written).toHaveLength(seed.transactions.length)
    expect(await demoRowCount(database, user.id)).toBe(demoSeedSize(seed))
    const seqs = [
      ...(await database.select({ seq: books.changeSeq }).from(books)),
      ...(await database.select({ seq: wallets.changeSeq }).from(wallets)),
      ...(await database.select({ seq: categories.changeSeq }).from(categories)),
      ...written.map((row) => ({ seq: row.changeSeq })),
    ].map((row) => row.seq)
    expect(new Set(seqs).size).toBe(seqs.length)
    expect(written.every((row) => row.updatedBy === user.id && row.deletedAt === null)).toBe(true)
  })

  it('counts no rows for a user who is not a demo', async () => {
    const user = await repo.createUser({ email: 'a@example.com', displayName: 'a' })

    expect(await demoRowCount(database, user.id)).toBeNull()
  })

  it('deletes demos created before the cut-off with everything under them', async () => {
    const old = await newDemo('demo-old@demo.invalid')
    await repo.seedDemo(old.id, seedFor(), AT)
    const kept = await repo.createUser({ email: 'a@example.com', displayName: 'a' })

    const removed = await repo.deleteExpiredDemos(new Date(Date.now() + 1000))

    expect(removed).toBe(1)
    expect(await repo.findUserById(old.id)).toBeNull()
    expect(await repo.findUserById(kept.id)).not.toBeNull()
    expect(await database.select().from(transactions)).toHaveLength(0)
    expect(await database.select().from(books)).toHaveLength(0)
  })

  it('keeps a demo younger than the cut-off', async () => {
    await newDemo()

    expect(await repo.deleteExpiredDemos(new Date(Date.now() - 60_000))).toBe(0)
  })
})
