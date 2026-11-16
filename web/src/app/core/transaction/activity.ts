import type { ActivityAction, Transaction } from './transaction.type'

/** How long the server keeps a tombstone, so how far back activity reaches (shared-activity rule 1). */
export const ACTIVITY_DAYS = 90
export const ACTIVITY_MS = ACTIVITY_DAYS * 24 * 60 * 60 * 1000
/** An edit this soon after the add still reads as the add (shared-activity rule 4). */
export const ADD_WINDOW_MS = 60 * 1000

/**
 * A row's latest action and who did it (shared-activity rule 4). `ownerId` stands in for a null
 * `addedBy` (the owner added it); `actor` is null when it was `me`, or when nobody but this
 * device has the row yet (`pending`, or no `updatedBy` from the server).
 */
export const latestAction = (
  row: Pick<Transaction, 'addedBy' | 'updatedBy' | 'createdAt' | 'updatedAt' | 'deletedAt'>,
  ownerId: string | null,
  me: string | null,
  pending = false
): { action: ActivityAction; actor: string | null } => {
  const action: ActivityAction =
    row.deletedAt !== null
      ? 'deleted'
      : row.updatedAt - row.createdAt <= ADD_WINDOW_MS
        ? 'added'
        : 'edited'
  const who = action === 'added' ? (row.addedBy ?? ownerId) : row.updatedBy
  return { action, actor: pending || who === null || who === me ? null : who }
}

/**
 * The same choice in SQL over `transactions` (alias `t`), for an own book: who did the row's
 * latest action, NULL for the owner (a null `added_by`) or a row the server hasn't seen.
 */
export const ACTOR_SQL = `CASE
  WHEN t.deleted_at IS NOT NULL THEN t.updated_by
  WHEN t.updated_at - t.created_at <= ${ADD_WINDOW_MS} THEN t.added_by
  ELSE t.updated_by END`

const DAY_MS = 24 * 60 * 60 * 1000

/** Whole days until `expiresAt` (an ended share's last day counts as 1); null without a date. */
export const activityDaysLeft = (expiresAt: number | null, now = Date.now()): number | null =>
  expiresAt === null ? null : Math.max(1, Math.ceil((expiresAt - now) / DAY_MS))

/** "เหลือ n วัน", or "วันนี้วันสุดท้าย" on the last one (shared-activity rule 7). */
export const activityLeftText = (
  days: number,
  t: (key: string, params?: Record<string, unknown>) => string
): string => (days <= 1 ? t('activity.lastDay') : t('activity.daysLeft', { count: days }))
