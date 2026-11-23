import { and, asc, desc, eq, gt, isNull, lt, ne, or, sql } from 'drizzle-orm'
import type { Database } from '@/core/database'
import {
  otpChallenges,
  passwordCredentials,
  rateLimitBuckets,
  sessions,
  userIdentities,
  users,
} from '@/core/database/schema/auth'
import { books } from '@/core/database/schema/book'
import { categories } from '@/core/database/schema/category'
import { debtEntries, debts } from '@/core/database/schema/debt'
import { events } from '@/core/database/schema/event'
import { recurringRules } from '@/core/database/schema/recurring'
import { walletInvites } from '@/core/database/schema/sharing'
import { syncState } from '@/core/database/schema/sync'
import { transactions } from '@/core/database/schema/transaction'
import { transfers } from '@/core/database/schema/transfer'
import { walletMembers, wallets } from '@/core/database/schema/wallet'
import { wrapUnexpected } from '@/core/error'
import { demoSeedSize } from './auth.demo-seed'
import type {
  ChallengeChannel,
  ChallengePurpose,
  OtpChallenge,
  Session,
  User,
  UserIdentity,
} from './auth.entity'
import type { AuthRepository } from './auth.repository'

/** Transactions per insert of the demo seed (SQLite caps the values one statement binds). */
const SEED_SLICE = 100

type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0]
type Executor = Database | Transaction

type UserRow = typeof users.$inferSelect
type ChallengeRow = typeof otpChallenges.$inferSelect

const toUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  displayName: row.displayName,
  avatarUrl: row.avatarUrl,
  emailVerifiedAt: row.emailVerifiedAt,
  phone: row.phone,
  phoneVerifiedAt: row.phoneVerifiedAt,
  status: row.status,
  timezone: row.timezone,
  isDemo: row.isDemo,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
})

const toChallenge = (row: ChallengeRow): OtpChallenge => ({
  id: row.id,
  channel: row.channel,
  purpose: row.purpose,
  destination: row.destination,
  userId: row.userId,
  codeHash: row.codeHash,
  linkTokenHash: row.linkTokenHash,
  attempts: row.attempts,
  expiresAt: row.expiresAt,
  consumedAt: row.consumedAt,
  createdAt: row.createdAt,
})

const toSession = (row: typeof sessions.$inferSelect): Session => ({ ...row })

const toIdentity = (row: typeof userIdentities.$inferSelect): UserIdentity => ({ ...row })

const challengeFor = (
  destination: string,
  purpose: ChallengePurpose,
  channel: ChallengeChannel = 'email'
) =>
  and(
    eq(otpChallenges.channel, channel),
    eq(otpChallenges.purpose, purpose),
    eq(otpChallenges.destination, destination)
  )

export const createDrizzleAuthRepository = (db: Executor): AuthRepository => {
  const run = async <T>(operation: string, work: () => Promise<T>) =>
    wrapUnexpected(work, { operation: `authRepository.${operation}` })

  return {
    transaction: async (work) =>
      run('transaction', async () =>
        db.transaction(async (tx) => work(createDrizzleAuthRepository(tx)))
      ),

    findUserById: async (id) =>
      run('findUserById', async () => {
        const row = await db.query.users.findFirst({ where: eq(users.id, id) })
        return row ? toUser(row) : null
      }),

    findUserByEmail: async (email) =>
      run('findUserByEmail', async () => {
        const row = await db.query.users.findFirst({ where: eq(users.email, email) })
        return row ? toUser(row) : null
      }),

    findUserByPhone: async (phone) =>
      run('findUserByPhone', async () => {
        const row = await db.query.users.findFirst({ where: eq(users.phone, phone) })
        return row ? toUser(row) : null
      }),

    setUserPhone: async (userId, phone, at) =>
      run('setUserPhone', async () => {
        const rows = await db
          .update(users)
          .set({ phone, phoneVerifiedAt: phone ? at : null, updatedAt: at })
          .where(eq(users.id, userId))
          .returning()
        const row = rows.at(0)
        return row ? toUser(row) : null
      }),

    setDisplayName: async (userId, displayName, at) =>
      run('setDisplayName', async () => {
        const rows = await db
          .update(users)
          .set({ displayName, updatedAt: at })
          .where(eq(users.id, userId))
          .returning()
        const row = rows.at(0)
        return row ? toUser(row) : null
      }),

    createUser: async (data) =>
      run('createUser', async () => {
        const [row] = await db.insert(users).values(data).returning()
        return toUser(row)
      }),

    markEmailVerified: async (userId, at) =>
      run('markEmailVerified', async () => {
        const rows = await db
          .update(users)
          .set({ emailVerifiedAt: at })
          .where(eq(users.id, userId))
          .returning()
        const row = rows.at(0)
        return row ? toUser(row) : null
      }),

    fillAvatarIfEmpty: async (userId, avatarUrl) =>
      run('fillAvatarIfEmpty', async () => {
        await db
          .update(users)
          .set({ avatarUrl })
          .where(and(eq(users.id, userId), isNull(users.avatarUrl)))
        const row = await db.query.users.findFirst({ where: eq(users.id, userId) })
        return row ? toUser(row) : null
      }),

    findIdentity: async (provider, providerSubject) =>
      run('findIdentity', async () => {
        const row = await db.query.userIdentities.findFirst({
          where: and(
            eq(userIdentities.provider, provider),
            eq(userIdentities.providerSubject, providerSubject)
          ),
        })
        return row ? toIdentity(row) : null
      }),

    findUserIdentity: async (userId, provider) =>
      run('findUserIdentity', async () => {
        const row = await db.query.userIdentities.findFirst({
          where: and(eq(userIdentities.userId, userId), eq(userIdentities.provider, provider)),
        })
        return row ? toIdentity(row) : null
      }),

    listIdentities: async (userId) =>
      run('listIdentities', async () => {
        const rows = await db.query.userIdentities.findMany({
          where: eq(userIdentities.userId, userId),
          orderBy: [asc(userIdentities.createdAt), asc(userIdentities.id)],
        })
        return rows.map(toIdentity)
      }),

    createIdentity: async (data) =>
      run('createIdentity', async () => {
        const [row] = await db.insert(userIdentities).values(data).returning()
        return toIdentity(row)
      }),

    deleteIdentity: async (userId, provider) =>
      run('deleteIdentity', async () => {
        const rows = await db
          .delete(userIdentities)
          .where(and(eq(userIdentities.userId, userId), eq(userIdentities.provider, provider)))
          .returning({ id: userIdentities.id })
        return rows.length > 0
      }),

    touchIdentity: async (id, at) =>
      run('touchIdentity', async () => {
        await db.update(userIdentities).set({ lastUsedAt: at }).where(eq(userIdentities.id, id))
      }),

    findPasswordHash: async (userId) =>
      run('findPasswordHash', async () => {
        const row = await db.query.passwordCredentials.findFirst({
          where: eq(passwordCredentials.userId, userId),
        })
        return row?.passwordHash ?? null
      }),

    savePasswordHash: async (userId, passwordHash, at) =>
      run('savePasswordHash', async () => {
        await db
          .insert(passwordCredentials)
          .values({ userId, passwordHash, updatedAt: at })
          .onConflictDoUpdate({
            target: passwordCredentials.userId,
            set: { passwordHash, updatedAt: at },
          })
      }),

    deletePasswordHash: async (userId) =>
      run('deletePasswordHash', async () => {
        const rows = await db
          .delete(passwordCredentials)
          .where(eq(passwordCredentials.userId, userId))
          .returning({ userId: passwordCredentials.userId })
        return rows.length > 0
      }),

    createChallenge: async (data) =>
      run('createChallenge', async () => {
        const [row] = await db
          .insert(otpChallenges)
          .values({ channel: 'email', ...data })
          .returning()
        return toChallenge(row)
      }),

    expireOpenChallenges: async (destination, purpose, at, channel) =>
      run('expireOpenChallenges', async () => {
        await db
          .update(otpChallenges)
          .set({ expiresAt: at })
          .where(
            and(
              challengeFor(destination, purpose, channel),
              isNull(otpChallenges.consumedAt),
              gt(otpChallenges.expiresAt, at)
            )
          )
      }),

    findLatestChallenge: async (destination, purpose, channel) =>
      run('findLatestChallenge', async () => {
        const row = await db.query.otpChallenges.findFirst({
          where: challengeFor(destination, purpose, channel),
          orderBy: [desc(otpChallenges.createdAt), desc(otpChallenges.id)],
        })
        return row ? toChallenge(row) : null
      }),

    expireOpenUserChallenges: async (userId, purpose, at) =>
      run('expireOpenUserChallenges', async () => {
        await db
          .update(otpChallenges)
          .set({ expiresAt: at })
          .where(
            and(
              eq(otpChallenges.userId, userId),
              eq(otpChallenges.purpose, purpose),
              isNull(otpChallenges.consumedAt),
              gt(otpChallenges.expiresAt, at)
            )
          )
      }),

    findLatestUserChallenge: async (userId, purpose) =>
      run('findLatestUserChallenge', async () => {
        const row = await db.query.otpChallenges.findFirst({
          where: and(eq(otpChallenges.userId, userId), eq(otpChallenges.purpose, purpose)),
          orderBy: [desc(otpChallenges.createdAt), desc(otpChallenges.id)],
        })
        return row ? toChallenge(row) : null
      }),

    findChallengeByLinkTokenHash: async (linkTokenHash) =>
      run('findChallengeByLinkTokenHash', async () => {
        const row = await db.query.otpChallenges.findFirst({
          where: eq(otpChallenges.linkTokenHash, linkTokenHash),
        })
        return row ? toChallenge(row) : null
      }),

    recordFailedAttempt: async (id) =>
      run('recordFailedAttempt', async () => {
        const rows = await db
          .update(otpChallenges)
          .set({ attempts: sql`${otpChallenges.attempts} + 1` })
          .where(eq(otpChallenges.id, id))
          .returning({ attempts: otpChallenges.attempts })
        return rows.at(0)?.attempts ?? null
      }),

    consumeChallenge: async (id, at) =>
      run('consumeChallenge', async () => {
        const rows = await db
          .update(otpChallenges)
          .set({ consumedAt: at })
          .where(and(eq(otpChallenges.id, id), isNull(otpChallenges.consumedAt)))
          .returning({ id: otpChallenges.id })
        return rows.length > 0
      }),

    createSession: async (data) =>
      run('createSession', async () => {
        const [row] = await db.insert(sessions).values(data).returning()
        return toSession(row)
      }),

    findSessionByTokenHash: async (tokenHash) =>
      run('findSessionByTokenHash', async () => {
        const row = await db.query.sessions.findFirst({ where: eq(sessions.tokenHash, tokenHash) })
        return row ? toSession(row) : null
      }),

    markSessionRotated: async (id, replacedById, at) =>
      run('markSessionRotated', async () => {
        const rows = await db
          .update(sessions)
          .set({ revokedAt: at, replacedById, lastUsedAt: at })
          .where(and(eq(sessions.id, id), isNull(sessions.revokedAt)))
          .returning({ id: sessions.id })
        return rows.length > 0
      }),

    revokeFamily: async (familyId, at) =>
      run('revokeFamily', async () => {
        const rows = await db
          .update(sessions)
          .set({ revokedAt: at })
          .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)))
          .returning({ id: sessions.id })
        return rows.length
      }),

    findActiveSession: async (familyId) =>
      run('findActiveSession', async () => {
        const row = await db.query.sessions.findFirst({
          where: and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)),
          orderBy: [desc(sessions.createdAt), desc(sessions.id)],
        })
        return row ? toSession(row) : null
      }),

    setFamilyAuthTime: async (familyId, at) =>
      run('setFamilyAuthTime', async () => {
        await db
          .update(sessions)
          .set({ authTime: at })
          .where(and(eq(sessions.familyId, familyId), isNull(sessions.revokedAt)))
      }),

    listActiveSessions: async (userId, at) =>
      run('listActiveSessions', async () => {
        const rows = await db.query.sessions.findMany({
          where: and(
            eq(sessions.userId, userId),
            isNull(sessions.revokedAt),
            gt(sessions.expiresAt, at),
            gt(sessions.absoluteExpiresAt, at)
          ),
          orderBy: [desc(sessions.lastUsedAt), desc(sessions.id)],
        })
        return rows.map(toSession)
      }),

    revokeOtherFamilies: async (userId, keepFamilyId, at) =>
      run('revokeOtherFamilies', async () => {
        const rows = await db
          .update(sessions)
          .set({ revokedAt: at })
          .where(
            and(
              eq(sessions.userId, userId),
              ne(sessions.familyId, keepFamilyId),
              isNull(sessions.revokedAt)
            )
          )
          .returning({ id: sessions.id })
        return rows.length
      }),

    // One upsert, so concurrent hits can't both read the same count.
    hitRateLimit: async (key, windowMs, at) =>
      run('hitRateLimit', async () => {
        const windowEnded = sql`${rateLimitBuckets.windowStart} <= ${at.getTime() - windowMs}`
        const [row] = await db
          .insert(rateLimitBuckets)
          .values({ key, count: 1, windowStart: at })
          .onConflictDoUpdate({
            target: rateLimitBuckets.key,
            set: {
              count: sql`CASE WHEN ${windowEnded} THEN 1 ELSE ${rateLimitBuckets.count} + 1 END`,
              windowStart: sql`CASE WHEN ${windowEnded} THEN ${at.getTime()} ELSE ${rateLimitBuckets.windowStart} END`,
            },
          })
          .returning()
        return { count: row.count, windowStart: row.windowStart }
      }),

    peekRateLimit: async (key, windowMs, at) =>
      run('peekRateLimit', async () => {
        const row = await db.query.rateLimitBuckets.findFirst({
          where: eq(rateLimitBuckets.key, key),
        })
        const running = row && row.windowStart.getTime() > at.getTime() - windowMs
        return running ? { count: row.count, windowStart: row.windowStart } : null
      }),

    // Buckets carry no window length, so one older than the longest window (a day) is stale.
    countSharedPeople: async (userId) =>
      run('countSharedPeople', async () => {
        const rows = await db
          .select({ count: sql<number>`count(distinct ${walletMembers.userId})` })
          .from(walletMembers)
          .innerJoin(wallets, eq(wallets.id, walletMembers.walletId))
          .where(
            and(
              eq(wallets.userId, userId),
              isNull(wallets.deletedAt),
              ne(walletMembers.userId, userId)
            )
          )
        return Number(rows.at(0)?.count ?? 0)
      }),

    deleteUser: async (userId, email) =>
      run('deleteUser', async () => {
        await db
          .delete(otpChallenges)
          .where(and(eq(otpChallenges.channel, 'email'), eq(otpChallenges.destination, email)))
        await db.delete(walletInvites).where(eq(walletInvites.email, email))
        const deleted = await db
          .delete(users)
          .where(eq(users.id, userId))
          .returning({ id: users.id })
        return deleted.length > 0
      }),

    seedDemo: async (userId, seed, at) =>
      run('seedDemo', async () => {
        const count = demoSeedSize(seed)
        // A block of `changeSeq`s, as a push takes them (one counter for the whole database).
        const [state] = await db
          .update(syncState)
          .set({ lastSeq: sql`${syncState.lastSeq} + ${count}` })
          .where(eq(syncState.id, 1))
          .returning({ lastSeq: syncState.lastSeq })
        let seq = state.lastSeq - count
        const time = at.getTime()
        const sync = (createdAt = time) => ({
          userId,
          createdAt,
          updatedAt: createdAt,
          deletedAt: null,
          changeSeq: ++seq,
          updatedBy: userId,
        })
        // Parents before the rows that point at them (the FKs).
        await db.insert(books).values({ ...seed.book, ...sync() })
        await db.insert(wallets).values(seed.wallets.map((row) => ({ ...row, ...sync() })))
        // Top-level categories first: children point at them.
        const ordered = [
          ...seed.categories.filter((row) => row.parentId === null),
          ...seed.categories.filter((row) => row.parentId !== null),
        ]
        await db
          .insert(categories)
          .values(ordered.map((row) => ({ ...row, mergedIntoId: null, ...sync() })))
        await db
          .insert(events)
          .values(seed.events.map((row) => ({ ...row, isClosed: true, ...sync() })))
        await db.insert(recurringRules).values(
          seed.recurringRules.map((row) => ({
            ...row,
            kind: 'transaction',
            toWalletId: null,
            debtId: null,
            excludeFromReport: false,
            frequency: 'month',
            interval: 1,
            endOn: null,
            endCount: null,
            isPaused: false,
            ...sync(),
          }))
        )
        await db.insert(debts).values(
          seed.debts.map((row) => ({
            ...row,
            direction: 'lent',
            countAs: 'spent',
            categoryId: null,
            ...sync(),
          }))
        )
        await db.insert(debtEntries).values(
          seed.debtEntries.map(({ createdAt, ...row }) => ({
            ...row,
            recurringId: null,
            ...sync(createdAt),
          }))
        )
        await db.insert(transfers).values(
          seed.transfers.map(({ createdAt, ...row }) => ({
            ...row,
            recurringId: null,
            ...sync(createdAt),
          }))
        )
        // In slices: one statement's bound values are capped.
        for (let start = 0; start < seed.transactions.length; start += SEED_SLICE) {
          const slice = seed.transactions.slice(start, start + SEED_SLICE)
          await db.insert(transactions).values(
            slice.map(({ createdAt, ...row }) => ({
              ...row,
              debtId: null,
              addedBy: null,
              ...sync(createdAt),
            }))
          )
        }
      }),

    deleteExpiredDemos: async (createdBefore) =>
      run('deleteExpiredDemos', async () => {
        // Every table that references `users` cascades (privacy rule 8); a demo holds no address
        // anyone could have invited or mailed, so nothing is left by email.
        const deleted = await db
          .delete(users)
          .where(and(eq(users.isDemo, true), lt(users.createdAt, createdBefore)))
          .returning({ id: users.id })
        return deleted.length
      }),

    deleteExpired: async (before) =>
      run('deleteExpired', async () => {
        const challenges = await db
          .delete(otpChallenges)
          .where(lt(otpChallenges.expiresAt, before))
          .returning({ id: otpChallenges.id })
        const ended = await db
          .delete(sessions)
          .where(
            or(
              lt(sessions.revokedAt, before),
              lt(sessions.expiresAt, before),
              lt(sessions.absoluteExpiresAt, before)
            )
          )
          .returning({ id: sessions.id })
        const buckets = await db
          .delete(rateLimitBuckets)
          .where(lt(rateLimitBuckets.windowStart, before))
          .returning({ key: rateLimitBuckets.key })
        // Sharing only drops expired invites when the book invites again, so stale ones stay here.
        const invites = await db
          .delete(walletInvites)
          .where(lt(walletInvites.expiresAt, before.getTime()))
          .returning({ id: walletInvites.id })
        return {
          challenges: challenges.length,
          sessions: ended.length,
          rateLimitBuckets: buckets.length,
          invites: invites.length,
        }
      }),
  }
}
