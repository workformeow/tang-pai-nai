import { and, eq, exists, isNull, or, sql } from 'drizzle-orm'
import { profiles } from './schema/profile'
import { walletMembers, wallets } from './schema/wallet'
import type { Executor } from './client'

// Who hears a shared profile's pokes (docs/features/live-sync.md rules 3, 6). Sync and live both
// read the sharing tables, which no other feature may import, so this lives here (like
// `wallet-access`).

/** A wallet a member may see (sharing rule 8): live, open, on a live profile. */
const visible = and(
  isNull(wallets.deletedAt),
  eq(wallets.isArchived, false),
  isNull(profiles.deletedAt)
)

const hasMembers = (executor: Executor) =>
  exists(
    executor
      .select({ one: sql`1` })
      .from(walletMembers)
      .where(eq(walletMembers.walletId, wallets.id))
  )

/** The wallet's profile when someone besides the owner may see the wallet, else null (rule 6). */
export const sharedProfileOf = async (
  executor: Executor,
  walletId: string
): Promise<string | null> => {
  const row = (
    await executor
      .select({ profileId: wallets.profileId })
      .from(wallets)
      .innerJoin(profiles, eq(profiles.id, wallets.profileId))
      .where(and(eq(wallets.id, walletId), visible, hasMembers(executor)))
  ).at(0)
  return row?.profileId ?? null
}

/**
 * Rule 3: the profiles whose `profile:` channel `userId` may hear: theirs or not, with at least
 * one live, shared wallet that `userId` owns or is a member of.
 */
export const listenableProfiles = async (executor: Executor, userId: string): Promise<string[]> => {
  const rows = await executor
    .selectDistinct({ profileId: wallets.profileId })
    .from(wallets)
    .innerJoin(profiles, eq(profiles.id, wallets.profileId))
    .where(
      and(
        visible,
        hasMembers(executor),
        or(
          eq(wallets.userId, userId),
          exists(
            executor
              .select({ one: sql`1` })
              .from(walletMembers)
              .where(and(eq(walletMembers.walletId, wallets.id), eq(walletMembers.userId, userId)))
          )
        )
      )
    )
  return rows.map((row) => row.profileId)
}
