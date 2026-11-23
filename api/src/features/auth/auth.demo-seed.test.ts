import { describe, expect, it } from 'vitest'
import { buildDemoSeed, demoSeedSize, localDay, occurrenceId } from './auth.demo-seed'
import type { DemoSeed } from './auth.demo-seed'

// docs/features/demo.md rules 6–7 and Decisions Q1: the template, dated from the day it starts.

const TODAY = '2026-11-17'
const NOW = Date.parse('2026-11-17T05:00:00.000Z')

const counter = () => {
  let next = 0
  return () => `id-${String(++next).padStart(4, '0')}`
}

const build = (today = TODAY, lang: 'th' | 'en' = 'th') =>
  buildDemoSeed({ lang, today, now: Date.parse(`${today}T05:00:00.000Z`), newId: counter() })

const category = (seed: DemoSeed, name: string) => {
  const found = seed.categories.find((item) => item.name === name)
  if (!found) {
    throw new Error(`no category ${name}`)
  }
  return found
}

const wallet = (seed: DemoSeed, name: string) => {
  const found = seed.wallets.find((item) => item.name === name)
  if (!found) {
    throw new Error(`no wallet ${name}`)
  }
  return found
}

/** Each wallet's lowest and last balance, walking the rows in date order (wallet rule 12). */
const balances = (seed: DemoSeed) => {
  const income = new Set(seed.categories.filter((c) => c.type === 'income').map((c) => c.id))
  const moves: [string, string, number][] = [
    ...seed.transactions.map((t): [string, string, number] => [
      t.occurredOn,
      t.walletId,
      income.has(t.categoryId) ? t.amount : -t.amount,
    ]),
    ...seed.transfers.flatMap((t): [string, string, number][] => [
      [t.occurredOn, t.fromWalletId, -t.amount],
      [t.occurredOn, t.toWalletId, t.amount],
    ]),
    ...seed.debtEntries.map((e): [string, string, number] => [
      e.occurredOn,
      e.walletId,
      e.kind === 'principal' ? -e.amount : e.amount,
    ]),
  ].sort((a, b) => a[0].localeCompare(b[0]))
  const now = new Map(seed.wallets.map((w) => [w.id, w.initialBalance]))
  const lowest = new Map(now)
  for (const [, walletId, amount] of moves) {
    const value = (now.get(walletId) ?? 0) + amount
    now.set(walletId, value)
    lowest.set(walletId, Math.min(lowest.get(walletId) ?? value, value))
  }
  return { now, lowest }
}

describe('buildDemoSeed', () => {
  it('gives one book with the wallets of rule 6, the card and savings out of the total', () => {
    const seed = build()

    expect(seed.book.name).toBe('ส่วนตัว')
    expect(seed.wallets.map((w) => [w.name, w.currencyCode, w.excludeFromTotal])).toEqual([
      ['เงินสด', 'THB', false],
      ['บัญชีธนาคาร', 'THB', false],
      ['บัตรเครดิต', 'THB', true],
      ['เงินออม', 'THB', true],
      ['เงินเยน', 'JPY', false],
    ])
    expect(wallet(seed, 'บัตรเครดิต').isCreditCard).toBe(true)
    expect(seed.wallets.every((w) => w.bookId === seed.book.id)).toBe(true)
  })

  it('writes the default categories in the language asked, parents before children', () => {
    const th = build()
    const en = build(TODAY, 'en')

    expect(th.categories).toHaveLength(32)
    expect(category(th, 'อาหารประจำวัน').parentId).toBe(category(th, 'อาหารและเครื่องดื่ม').id)
    expect(category(th, 'รถไฟฟ้า').parentId).toBe(category(th, 'การเดินทาง').id)
    expect(en.book.name).toBe('Personal')
    expect(en.categories.map((c) => c.name)).toContain('Daily meals')
    const seen = new Set<string>()
    for (const item of th.categories) {
      expect(item.parentId === null || seen.has(item.parentId)).toBe(true)
      seen.add(item.id)
    }
  })

  it('dates every row within the 3 months up to the day it starts (rule 7)', () => {
    const seed = build()
    const days = [...seed.transactions, ...seed.transfers, ...seed.debtEntries].map(
      (row) => row.occurredOn
    )

    expect(days.every((day) => day > '2026-08-17' && day <= TODAY)).toBe(true)
    expect(days).toContain(TODAY)
    expect(seed.transactions.every((t) => t.createdAt <= NOW + 24 * 3_600_000)).toBe(true)
  })

  it('is the same template every time: only the ids differ', () => {
    const first = build()
    const second = buildDemoSeed({ lang: 'th', today: TODAY, now: NOW })
    const shape = (seed: DemoSeed) =>
      seed.transactions.map((t) => [t.occurredOn, t.amount, t.note, t.excludeFromReport])

    expect(shape(second)).toEqual(shape(first))
    expect(demoSeedSize(first)).toBe(demoSeedSize(second))
  })

  it('stays well under the 2,000 rows of rule 11, whatever day it starts', () => {
    for (const today of ['2026-01-31', '2026-02-28', '2026-03-01', '2026-11-17', '2026-12-25']) {
      const size = demoSeedSize(build(today))
      expect(size).toBeGreaterThan(400)
      expect(size).toBeLessThan(430)
    }
  })

  it('records rent by itself up to today and leaves the next one for the device', () => {
    const seed = build()
    const rent = seed.recurringRules.find((rule) => !rule.confirm)
    const recorded = seed.transactions.filter((t) => t.recurringId === rent?.id)

    expect(rent).toMatchObject({ startOn: '2026-09-01', nextOn: '2026-12-01' })
    expect(recorded.map((t) => t.occurredOn)).toEqual(['2026-09-01', '2026-10-01', '2026-11-01'])
    expect(recorded.map((t) => t.id)).toEqual(
      recorded.map((t) => occurrenceId(rent?.id ?? '', t.occurredOn))
    )
  })

  it('leaves today’s subscription due, so the due card shows (rule 6)', () => {
    const seed = build()
    const subscription = seed.recurringRules.find((rule) => rule.confirm)
    const recorded = seed.transactions.filter((t) => t.recurringId === subscription?.id)

    expect(subscription).toMatchObject({ startOn: '2026-09-17', nextOn: TODAY })
    expect(recorded.map((t) => t.occurredOn)).toEqual(['2026-09-17', '2026-10-17'])
  })

  it('lends to a coworker and has part of it back', () => {
    const seed = build()

    expect(seed.debts).toEqual([
      expect.objectContaining({
        person: 'เพื่อนร่วมงาน',
        currencyCode: 'THB',
        dueOn: '2026-12-17',
      }),
    ])
    expect(seed.debtEntries.map((e) => [e.kind, e.amount])).toEqual([
      ['principal', 500_000],
      ['repayment', 200_000],
    ])
  })

  it('tags the Japan trip, spends yen there and keeps the exchange out of the reports', () => {
    const seed = build()
    const [trip] = seed.events
    const yen = wallet(seed, 'เงินเยน')
    const exchange = seed.transactions.filter((t) => t.note.startsWith('แลกเงินเยน'))

    expect(trip).toMatchObject({ startOn: '2026-10-08', endOn: '2026-10-13' })
    expect(seed.transactions.filter((t) => t.eventId === trip.id).length).toBe(20)
    expect(exchange.map((t) => [t.walletId === yen.id, t.excludeFromReport, t.eventId])).toEqual([
      [false, true, null],
      [true, true, null],
    ])
    expect(balances(seed).now.get(yen.id)).toBe(19_930)
  })

  it('never takes cash, the bank or savings below 0, whatever day of the year it starts', () => {
    for (let day = Date.parse('2026-01-01'); day < Date.parse('2027-01-01'); day += 86_400_000) {
      const seed = build(new Date(day).toISOString().slice(0, 10))
      const { lowest } = balances(seed)
      for (const name of ['เงินสด', 'บัญชีธนาคาร', 'เงินออม', 'เงินเยน']) {
        expect(lowest.get(wallet(seed, name).id)).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('leaves a balance owed on the card (credit-card rule 3)', () => {
    const seed = build()

    expect(balances(seed).now.get(wallet(seed, 'บัตรเครดิต').id)).toBeLessThan(0)
  })
})

describe('localDay', () => {
  it('is the date in the time zone given, not UTC', () => {
    expect(localDay(new Date('2026-11-16T18:30:00.000Z'), 'Asia/Bangkok')).toBe('2026-11-17')
    expect(localDay(new Date('2026-11-16T18:30:00.000Z'), 'UTC')).toBe('2026-11-16')
  })
})

describe('occurrenceId', () => {
  it('is a UUID v8 that depends only on the rule and the day', () => {
    const id = occurrenceId('rule-1', '2026-11-01')

    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-8[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    expect(occurrenceId('rule-1', '2026-11-01')).toBe(id)
    expect(occurrenceId('rule-1', '2026-12-01')).not.toBe(id)
  })

  it('matches the web’s id for the same occurrence (recurring rule 9)', () => {
    // From web/src/app/core/recurring/occurrence-id.ts with the same input.
    expect(occurrenceId('01900000-0000-7000-8000-000000000001', '2026-11-01')).toBe(
      '37a8e5d3-bd5e-8ba5-95ba-f491731dd9f7'
    )
  })
})
