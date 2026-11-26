import { DOCUMENT } from '@angular/common'
import { computed, effect, inject, Service, signal, untracked } from '@angular/core'
import { TranslocoService } from '@jsverse/transloco'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { OfflineService } from '@/core/offline'
import { DEBT_ENTRY_TABLE } from '@/core/wallet'
import { toDay } from '@/shared/utils'
import { FUTURE, PERIOD_UNITS, periodLabel, periodRange, periodTabs, sameRange } from './period'
import { TRANSACTION_PREF_PREFIX, TRANSACTION_TABLE, TRANSFER_TABLE } from './transaction.type'
import type { PeriodTab, PeriodUnit } from './period'
import type { DayRange } from './transaction.type'

const NO_RANGE: DayRange = { from: null, to: null }

/** Where the unit is kept per book (`tpn-book:` keys are wiped with the device). */
const UNIT_KEY = `${TRANSACTION_PREF_PREFIX}period:unit:`
/** Before the two tabs shared one period, the Transactions tab kept its unit in its view. */
const OLD_VIEW_KEY = `${TRANSACTION_PREF_PREFIX}view:`

/**
 * The chosen period, one for the Transactions and Reports tabs (owner, 2026-11): "ดูตาม" (`unit`)
 * and the days it covers (`range`). Both tabs filter by `range`; the chips are worked out from it.
 * The unit is remembered per book; the range starts on the current period. A range that was the
 * current period (or "อนาคต") moves on with the date; any other stays where it is.
 */
@Service()
export class PeriodService {
  private offlineService = inject(OfflineService)
  private bookService = inject(BookService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private window = inject(DOCUMENT).defaultView

  /** The device's date, refreshed when the app comes back and every minute. */
  today = signal(toDay())
  unit = signal<PeriodUnit>('month')
  range = signal<DayRange>(periodRange('month', 0, toDay(), NO_RANGE))
  /** The custom range sheet (the shell mounts it). */
  customSheet = signal(false)

  /** The book's oldest and newest transaction, transfer or debt entry day. */
  private bounds = computed<{ first: string | null; last: string | null }>(() => {
    const bookId = this.bookService.current()?.id
    const none = { first: null, last: null }
    if (!bookId) {
      return none
    }
    this.offlineService.changes()
    if (!this.offlineService.isOpen()) {
      return none
    }
    const row = this.offlineService
      .db()
      .selectObjects(
        `SELECT min(first) AS first, max(last) AS last FROM (
           SELECT min(occurred_on) AS first, max(occurred_on) AS last FROM ${TRANSACTION_TABLE}
           WHERE book_id = ? AND deleted_at IS NULL
           UNION ALL
           SELECT min(occurred_on), max(occurred_on) FROM ${TRANSFER_TABLE}
           WHERE book_id = ? AND deleted_at IS NULL
           UNION ALL
           SELECT min(occurred_on), max(occurred_on) FROM ${DEBT_ENTRY_TABLE}
           WHERE book_id = ? AND deleted_at IS NULL AND wallet_id IS NOT NULL
         )`,
        [bookId, bookId, bookId]
      )
      .at(0)
    const text = (value: unknown) => (typeof value === 'string' ? value : null)
    return { first: text(row?.['first']), last: text(row?.['last']) }
  })
  /** Where the period tabs start. */
  firstDay = computed(() => this.bounds().first)
  /** Where "ทั้งหมด" and "อนาคต" end in the reports. */
  lastDay = computed(() => this.bounds().last)

  /**
   * The tabs of the unit, oldest first (`09/2026 · เดือนที่แล้ว · เดือนนี้ · อนาคต`): back to the
   * book's oldest row, or to the chosen period when that is older (kept over a new month).
   */
  tabs = computed(() => {
    const firstDay = this.firstDay()
    const from = this.range().from
    const start = from && (!firstDay || from < firstDay) ? from : firstDay
    return periodTabs(this.unit(), this.today(), start)
  })
  /** The tab whose days are the chosen range; null when none is. */
  tab = computed<PeriodTab | null>(() => {
    const unit = this.unit()
    const today = this.today()
    const range = this.range()
    return this.tabs().find((tab) => sameRange(periodRange(unit, tab, today, range), range)) ?? null
  })
  /** The chosen tab's place, oldest first (the list slides in from that side). */
  tabIndex = computed(() => {
    const tab = this.tab()
    return tab === null ? -1 : this.tabs().indexOf(tab)
  })
  /** The chips' labels in the app's language. */
  chips = computed(() => {
    this.languageService.language()
    const unit = this.unit()
    const today = this.today()
    const range = this.range()
    return this.tabs().map((tab) => {
      const label = periodLabel(unit, tab, today, range)
      return { id: tab, label: 'key' in label ? this.transloco.translate(label.key) : label.text }
    })
  })
  /** The custom range sheet's start: the chosen range while it is custom. */
  custom = computed(() => (this.unit() === 'custom' ? this.range() : NO_RANGE))

  constructor() {
    // Each book has its own remembered unit; it opens on the current period.
    effect(() => {
      const bookId = this.bookService.currentId() ?? ''
      untracked(() => {
        const unit = this.readUnit(bookId)
        this.unit.set(unit)
        this.range.set(periodRange(unit, 0, this.today(), NO_RANGE))
      })
    })
    // A new day: the current period (and "อนาคต") move with it.
    let before = this.today()
    effect(() => {
      const today = this.today()
      untracked(() => {
        const unit = this.unit()
        for (const tab of [0, FUTURE] as const) {
          if (sameRange(this.range(), periodRange(unit, tab, before, NO_RANGE))) {
            this.range.set(periodRange(unit, tab, today, NO_RANGE))
            break
          }
        }
        before = today
      })
    })
    const refresh = () => this.today.set(toDay())
    this.window?.document.addEventListener('visibilitychange', refresh)
    this.window?.setInterval(refresh, 60_000)
  }

  /** Chooses a tab of the current unit. */
  select(tab: number | string): void {
    const chosen = this.tabs().find((item) => String(item) === String(tab))
    if (chosen !== undefined) {
      this.range.set(periodRange(this.unit(), chosen, this.today(), this.range()))
    }
  }

  /** A sideways swipe: the next (1) or previous (−1) period. */
  move(step: 1 | -1): void {
    const tabs = this.tabs()
    const index = this.tabIndex()
    const next = index < 0 ? undefined : tabs[index + step]
    if (next !== undefined) {
      this.select(next)
    }
  }

  /** Chooses "ดูตาม"; the tabs start again on the current period. Remembered for the book. */
  selectUnit(unit: PeriodUnit): void {
    this.unit.set(unit)
    this.range.set(periodRange(unit, 0, this.today(), NO_RANGE))
    if (unit !== 'custom') {
      this.writeUnit(unit)
    }
  }

  /** A custom range (from ≤ to); not remembered, so the book comes back on its unit. */
  selectCustom(range: DayRange): void {
    this.unit.set('custom')
    this.range.set(range)
  }

  private readUnit(bookId: string): PeriodUnit {
    const valid = (unit: unknown): unit is PeriodUnit =>
      PERIOD_UNITS.includes(unit as PeriodUnit) && unit !== 'custom'
    try {
      const saved = this.storage()?.getItem(`${UNIT_KEY}${bookId}`)
      if (valid(saved)) {
        return saved
      }
      // The Transactions tab's unit from before, kept in its view.
      const raw = this.storage()?.getItem(`${OLD_VIEW_KEY}${bookId}`)
      const old: unknown = raw ? JSON.parse(raw) : null
      const unit = old && typeof old === 'object' ? (old as Record<string, unknown>)['unit'] : null
      if (!valid(unit)) {
        return 'month'
      }
      this.storage()?.setItem(`${UNIT_KEY}${bookId}`, unit)
      return unit
    } catch {
      return 'month'
    }
  }

  private writeUnit(unit: PeriodUnit): void {
    const bookId = this.bookService.current()?.id
    try {
      if (bookId) {
        this.storage()?.setItem(`${UNIT_KEY}${bookId}`, unit)
      }
    } catch {
      // A blocked storage only loses the convenience.
    }
  }

  /** Lasting on a trusted device, for the tab's life on an untrusted one (like the book). */
  private storage(): Storage | null {
    try {
      return this.offlineService.isTrusted()
        ? (this.window?.localStorage ?? null)
        : (this.window?.sessionStorage ?? null)
    } catch {
      return null
    }
  }
}
