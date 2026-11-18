import { ruleTitle } from '@/core/recurring'
import type { Occurrence, Translate } from '@/core/recurring'
import { signedAmount } from '@/core/transaction'
import type { EntryItem } from '@/core/transaction'
import { addDays, fromDay } from '@/shared/utils'

/** A wallet's badge on a row, while "ทุกกระเป๋า" shows several wallets. */
export interface RowWallet {
  icon: string
  color: string
  name: string
}

/** One stored row of a day: a transaction, a side of a transfer or a debt entry. */
export interface EntryRow {
  item: EntryItem
  /** Unique per row: a transfer has two (transfer → Web screens, Q5). */
  key: string
  amount: string
  /** Money in (income, a transfer received): the income colour; else the expense colour. */
  positive: boolean
  wallet: RowWallet | null
  /** Saved here, not on the server yet. */
  pending: boolean
  /** "แก้ไขโดย …" / "เพิ่มโดย …" when someone else touched it last (shared-activity rule 6). */
  touchedBy: string | null
}

/** A recurring occurrence still to come (recurring rule 17): shown, never counted. */
export interface UpcomingRow {
  occurrence: Occurrence
  title: string
  sub: string
  amount: string
  positive: boolean
  wallet: RowWallet | null
}

/** One day's card: the big date, its words, the day's net and its rows (rule 13's order). */
export interface DayGroup {
  day: string
  number: string
  /** วันนี้ / เมื่อวาน / the weekday. */
  title: string
  /** Month and year (ค.ศ.). */
  subtitle: string
  total: string
  rows: EntryRow[]
  upcoming: UpcomingRow[]
}

/** What the day cards are written with. */
export interface DayContext {
  locale: string
  today: string
  t: Translate
  /** A signed minor amount: with the currency symbol while the rows mix currencies. */
  money: (minor: number, currencyCode: string) => string
  /** A wallet's badge, or null while one wallet is in view. */
  walletOf: (walletId: string) => RowWallet | null
}

/**
 * The row's signed amount: a transaction by its category's type, a transfer by its side, a debt
 * entry by the money in its wallet.
 */
export const entrySign = (item: EntryItem): number => {
  switch (item.kind) {
    case 'transfer':
      return item.side === 'in' ? item.amount : -item.amount
    case 'debt':
      return item.signed
    default:
      return signedAmount(item.amount, item.type)
  }
}

/** An empty card for `day`. */
const newDay = (day: string, context: DayContext): DayGroup => {
  const date = fromDay(day)
  const { locale, today, t } = context
  return {
    day,
    number: day.slice(8, 10),
    title:
      day === today
        ? t('transactions.today')
        : day === addDays(today, -1)
          ? t('transactions.yesterday')
          : new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
    subtitle: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date),
    total: '',
    rows: [],
    upcoming: [],
  }
}

/**
 * `items` (newest first) into day cards. `about` adds what the row needs from outside: whether it
 * waits for sync, and who else touched it.
 */
export const groupByDay = (
  items: readonly EntryItem[],
  context: DayContext,
  about: (item: EntryItem) => { pending: boolean; touchedBy: string | null }
): DayGroup[] => {
  const groups: DayGroup[] = []
  for (const item of items) {
    let group = groups.at(-1)
    if (group?.day !== item.occurredOn) {
      group = newDay(item.occurredOn, context)
      groups.push(group)
    }
    const signed = entrySign(item)
    group.rows.push({
      item,
      key: item.kind === 'transfer' ? `${item.id}:${item.side}` : item.id,
      amount: context.money(signed, item.currencyCode),
      positive: signed > 0,
      wallet: context.walletOf(item.walletId),
      ...about(item),
    })
  }
  return groups
}

/**
 * Each card's net, per currency, from `all` the period's rows (newest first), so a day cut by the
 * page limit still totals every row. Transfer rule 5, debt rule 7: income − expense only.
 */
export const addDayTotals = (
  groups: DayGroup[],
  all: readonly EntryItem[],
  money: DayContext['money']
): void => {
  const last = groups.at(-1)?.day ?? ''
  const daySums = new Map<string, Map<string, number>>()
  for (const item of all) {
    if (item.occurredOn < last) {
      break
    }
    if (item.kind !== 'transaction') {
      continue
    }
    const sums = daySums.get(item.occurredOn) ?? new Map<string, number>()
    sums.set(
      item.currencyCode,
      (sums.get(item.currencyCode) ?? 0) + signedAmount(item.amount, item.type)
    )
    daySums.set(item.occurredOn, sums)
  }
  for (const group of groups) {
    const sums = daySums.get(group.day) ?? new Map<string, number>()
    group.total = [...sums.entries()].map(([code, sum]) => money(sum, code)).join(' · ')
  }
}

/**
 * Recurring rule 17: "อนาคต" shows what the rules will record, beside the stored rows, in the
 * day cards (new cards as needed), newest day first.
 */
export const addUpcoming = (
  groups: DayGroup[],
  occurrences: readonly Occurrence[],
  walletIds: readonly string[],
  context: DayContext
): DayGroup[] => {
  const byDay = new Map(groups.map((group) => [group.day, group]))
  for (const occurrence of occurrences) {
    const { item } = occurrence
    let group = byDay.get(occurrence.on)
    if (!group) {
      group = newDay(occurrence.on, context)
      byDay.set(occurrence.on, group)
      groups.push(group)
    }
    const transfer = item.rule.kind === 'transfer'
    // A transfer's side in view: the money leaving, unless only the wallet it goes to shows.
    const incoming = transfer && !walletIds.includes(item.rule.walletId)
    const sign = transfer ? (incoming ? 1 : -1) : item.sign
    const shownWallet = incoming ? item.rule.toWalletId : item.rule.walletId
    group.upcoming.push({
      occurrence,
      title: ruleTitle(item, context.t),
      sub: [
        transfer ? `${item.walletName} → ${item.toWalletName}` : item.rule.note,
        context.t('recurring.notRecorded'),
      ]
        .filter((part) => part)
        .join(' · '),
      amount: context.money(sign * item.rule.amount, item.currencyCode),
      positive: sign > 0,
      wallet: shownWallet ? context.walletOf(shownWallet) : null,
    })
  }
  return groups.sort((a, b) => b.day.localeCompare(a.day))
}
