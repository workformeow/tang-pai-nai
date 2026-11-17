import type { ElementRef } from '@angular/core'
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArrowLeftRight,
  lucideBell,
  lucideChevronRight,
  lucideCloud,
  lucideCreditCard,
  lucideHandCoins,
  lucidePlane,
  lucideReceiptText,
  lucideRepeat,
  lucideUsers,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { AuthStore } from '@/core/auth'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { RecurringService, ruleTitle, shortDate } from '@/core/recurring'
import type { Occurrence } from '@/core/recurring'
import { SharingService } from '@/core/sharing'
import {
  FUTURE,
  latestAction,
  periodLabel,
  signedAmount,
  TransactionService,
  TransferService,
} from '@/core/transaction'
import type { EntryItem, PeriodTab } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { DueSheet } from '@/features/transactions/components/due-sheet'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { MoneySummaryCard } from '@/shared/components/money-summary'
import type { MoneySummaryLine } from '@/shared/components/money-summary'
import { PeriodStrip, Swipe } from '@/shared/components/period'
import { Slide } from '@/shared/components/slide'
import { addDays, formatAmount, formatMoney, fromDay } from '@/shared/utils'

/** One day's card: the big date, its words, the day's net and its rows (rule 13's order). */
interface DayGroup {
  day: string
  number: string
  /** วันนี้ / เมื่อวาน / the weekday. */
  title: string
  /** Month and year (ค.ศ.). */
  subtitle: string
  total: string
  totalSign: number
  items: {
    item: EntryItem
    /** Unique per row: a transfer has two (transfer → Web screens, Q5). */
    key: string
    amount: string
    /** Money in (income, a transfer received): the income colour; else the expense colour. */
    positive: boolean
    /** The wallet's badge, only while "ทุกกระเป๋า" shows several wallets. */
    wallet: { icon: string; color: string; name: string } | null
    pending: boolean
  }[]
  /** Recurring occurrences still to come (recurring rule 17): shown, never counted. */
  upcoming: {
    occurrence: Occurrence
    title: string
    sub: string
    amount: string
    positive: boolean
    wallet: { icon: string; color: string; name: string } | null
  }[]
}

/**
 * The Transactions tab (docs/features/transaction.md → Web screens, owner's choices in #8, Money
 * Lover style). The header (layout/transactions-header) holds the wallet switcher and "ดูตาม";
 * this page shows the balance, the period tabs, the period's summary and its days. The shell
 * shows the create step or the first-wallet step instead while those are missing.
 */
@Component({
  selector: 'app-transactions-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmButton,
    EmptyState,
    IconBadge,
    MoneySummaryCard,
    PeriodStrip,
    Swipe,
    Slide,
    DueSheet,
  ],
  providers: [
    provideIcons({
      lucideArrowLeftRight,
      lucideBell,
      lucideChevronRight,
      lucideCloud,
      lucideCreditCard,
      lucideHandCoins,
      lucidePlane,
      lucideReceiptText,
      lucideRepeat,
      lucideUsers,
    }),
  ],
  host: { class: 'flex flex-col overflow-x-clip' },
  templateUrl: './transactions-page.html',
})
export class TransactionsPage {
  protected transactionService = inject(TransactionService)
  private transferService = inject(TransferService)
  protected recurringService = inject(RecurringService)
  protected dueOpen = signal(false)
  /** The "ถึงกำหนด" card: how many are due and which (recurring rule 10). */
  protected due = computed(() => {
    this.languageService.language()
    const due = this.recurringService.due()
    if (due.length === 0) {
      return null
    }
    const locale = this.languageService.locale()
    const text = due
      .slice(0, 3)
      .map(
        (occurrence) => `${this.ruleTitle(occurrence)} ${shortDate(occurrence.on, locale, false)}`
      )
      .join(' · ')
    return { count: due.length, text }
  })
  private walletService = inject(WalletService)
  private bookService = inject(BookService)
  private authStore = inject(AuthStore)
  private sharingService = inject(SharingService)
  private networkStatusService = inject(NetworkStatusService)
  /** Books whose members were asked for, for "เพิ่มโดย …" (sharing rule 15). */
  private askedPeople = new Set<string>()
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  private more = viewChild<ElementRef<HTMLElement>>('more')
  private readonly PAGE = 100
  /**
   * Rows drawn so far (Volume: a long period such as "ทั้งหมด" holds thousands); more come as the
   * end of the list scrolls into view. Back to one page when the period or wallet changes.
   */
  private limit = linkedSignal({
    source: () => [this.transactionService.range(), this.transactionService.viewWalletIds()],
    computation: () => this.PAGE,
  })
  protected hasMore = computed(() => this.transactionService.items().length > this.limit())
  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON

  /** The chosen wallet's balance, or the total per currency (wallet rules 7, 12). */
  protected balance = computed(() => {
    const locale = this.languageService.locale()
    const wallet = this.transactionService.viewWallet()
    if (wallet) {
      // Credit-card rule 7: a card shows what it owes instead of its balance.
      const owing = wallet.isCreditCard
      const amount = owing ? this.walletService.owed(wallet) : this.walletService.balance(wallet)
      const minorUnit = this.walletService.minorUnit(wallet.currencyCode)
      return [
        {
          code: wallet.currencyCode,
          amount,
          owing,
          text: formatMoney(amount, wallet.currencyCode, minorUnit, locale),
        },
      ]
    }
    const totals = this.walletService.totals()
    const code = this.walletService.defaultCurrency()
    const lines =
      totals.length > 0
        ? totals
        : [{ currencyCode: code, minorUnit: this.walletService.minorUnit(code), amount: 0 }]
    return lines.map((line) => ({
      code: line.currencyCode,
      amount: line.amount,
      owing: false,
      text: formatMoney(line.amount, line.currencyCode, line.minorUnit, locale),
    }))
  })

  /** Credit-card rule 7: the card in view, while it owes money (and isn't a shared book's). */
  protected cardDue = computed(() => {
    const wallet = this.transactionService.viewWallet()
    const owed = wallet?.isCreditCard ? this.walletService.owed(wallet) : 0
    if (!wallet || owed <= 0 || wallet.isArchived) {
      return null
    }
    return {
      id: wallet.id,
      text: formatMoney(
        owed,
        wallet.currencyCode,
        this.walletService.minorUnit(wallet.currencyCode),
        this.languageService.locale()
      ),
    }
  })

  protected payCard(id: string): void {
    this.transferService.pay(id)
  }

  /** Rule 11 per currency; signed figures without the symbol (Money Lover style). */
  protected summary = computed<(MoneySummaryLine & { currencyCode: string })[]>(() => {
    const locale = this.languageService.locale()
    return this.transactionService.summaryLines().map((line) => ({
      currencyCode: line.currencyCode,
      hasIncome: line.income > 0,
      income: formatAmount(line.income, line.minorUnit, locale, true),
      expense: formatAmount(-line.expense, line.minorUnit, locale, true),
      net: formatAmount(line.net, line.minorUnit, locale, true),
      transfer: line.transfer ? formatAmount(line.transfer, line.minorUnit, locale, true) : null,
      debt: line.debt ? formatAmount(line.debt, line.minorUnit, locale, true) : null,
    }))
  })

  /** The period's rows grouped by day, newest first. */
  protected days = computed<DayGroup[]>(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const all = this.transactionService.items()
    const items = all.slice(0, this.limit())
    const today = this.transactionService.today()
    const showWallet = this.transactionService.viewWallet() === null
    const wallets = new Map(this.walletService.wallets().map((wallet) => [wallet.id, wallet]))
    const pending = this.transactionService.pendingIds()
    // The symbol is left out while every row shares one currency.
    const mixed = new Set(all.map((item) => item.currencyCode)).size > 1
    const money = (minor: number, code: string) => {
      const minorUnit = this.walletService.minorUnit(code)
      return mixed
        ? formatMoney(minor, code, minorUnit, locale)
        : formatAmount(minor, minorUnit, locale, true)
    }
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
    const groups: DayGroup[] = []
    const newGroup = (day: string): DayGroup => {
      const date = fromDay(day)
      return {
        day,
        number: day.slice(8, 10),
        title:
          day === today
            ? this.transloco.translate('transactions.today')
            : day === addDays(today, -1)
              ? this.transloco.translate('transactions.yesterday')
              : weekday.format(date),
        subtitle: monthYear.format(date),
        total: '',
        totalSign: 0,
        items: [],
        upcoming: [],
      }
    }
    for (const item of items) {
      let group = groups.at(-1)
      if (group?.day !== item.occurredOn) {
        group = newGroup(item.occurredOn)
        groups.push(group)
      }
      const wallet = showWallet ? wallets.get(item.walletId) : undefined
      const signed = entrySign(item)
      group.items.push({
        item,
        key: item.kind === 'transfer' ? `${item.id}:${item.side}` : item.id,
        amount: money(signed, item.currencyCode),
        positive: signed > 0,
        wallet: wallet ? { icon: wallet.icon, color: wallet.color, name: wallet.name } : null,
        pending: pending.has(item.id),
      })
    }
    // A day cut by the page limit still totals all its rows.
    const last = groups.at(-1)?.day ?? ''
    const daySums = new Map<string, Map<string, number>>()
    for (const item of all) {
      if (item.occurredOn < last) {
        break
      }
      // Transfer rule 5, debt rule 7: a day's net is income − expense only.
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
    // Recurring rule 17: "อนาคต" shows what the rules will record, beside the stored rows.
    if (this.transactionService.tab() !== FUTURE) {
      return groups
    }
    const walletIds = this.transactionService.viewWalletIds()
    const upcoming = this.recurringService.upcoming(this.transactionService.range(), walletIds)
    const byDay = new Map(groups.map((group) => [group.day, group]))
    for (const occurrence of upcoming) {
      const { item } = occurrence
      let group = byDay.get(occurrence.on)
      if (!group) {
        group = newGroup(occurrence.on)
        byDay.set(occurrence.on, group)
        groups.push(group)
      }
      const transfer = item.rule.kind === 'transfer'
      // A transfer's side in view: the money leaving, unless only the wallet it goes to shows.
      const incoming = transfer && !walletIds.includes(item.rule.walletId)
      const sign = transfer ? (incoming ? 1 : -1) : item.sign
      const minorUnit = this.walletService.minorUnit(item.currencyCode)
      const shownWallet = incoming ? item.rule.toWalletId : item.rule.walletId
      const wallet = showWallet && shownWallet ? wallets.get(shownWallet) : undefined
      group.upcoming.push({
        occurrence,
        title: ruleTitle(item, this.t),
        sub: [
          transfer ? `${item.walletName} → ${item.toWalletName}` : item.rule.note,
          this.transloco.translate('recurring.notRecorded'),
        ]
          .filter((part) => part)
          .join(' · '),
        amount: mixed
          ? formatMoney(sign * item.rule.amount, item.currencyCode, minorUnit, locale)
          : formatAmount(sign * item.rule.amount, minorUnit, locale, true),
        positive: sign > 0,
        wallet: wallet ? { icon: wallet.icon, color: wallet.color, name: wallet.name } : null,
      })
    }
    return groups.sort((a, b) => b.day.localeCompare(a.day))
  })

  private ruleTitle(occurrence: Occurrence): string {
    return ruleTitle(occurrence.item, this.t)
  }

  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)

  /**
   * Shared-activity rule 6: "แก้ไขโดย …" when someone else edited the row last, else "เพิ่มโดย …"
   * when someone else added it; null for rows you wrote. A name once read, else "อดีตสมาชิก".
   */
  protected touchedBy(item: EntryItem, pending: boolean): string | null {
    if (item.kind !== 'transaction' || pending) {
      return null
    }
    this.languageService.language()
    const me = this.authStore.user()?.id ?? null
    const ownerId = this.bookService.shared()?.owner.id ?? me
    const name = (id: string) =>
      this.transactionService.people().get(id) ?? this.transloco.translate('sharing.member')
    const { action, actor } = latestAction(item, ownerId, me)
    if (action === 'edited' && actor) {
      return this.transloco.translate('activity.editedBy', { name: name(actor) })
    }
    const adder = item.addedBy ?? ownerId
    return adder && adder !== me
      ? this.transloco.translate('sharing.addedBy', { name: name(adder) })
      : null
  }

  constructor() {
    // Draw the next page once the end of the list comes near.
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                this.limit.update((limit) => limit + this.PAGE)
              }
            },
            { rootMargin: '600px' }
          )
    inject(DestroyRef).onDestroy(() => observer?.disconnect())
    // Sharing rule 15 and shared-activity rules 1, 5: an own book's members (their names, the
    // wallets shared with them), read online once per book and session.
    effect(() => {
      const bookId = this.bookService.currentId()
      const online = this.networkStatusService.isOnline()
      if (!bookId || !online || this.bookService.isShared()) {
        return
      }
      if (!this.askedPeople.has(bookId)) {
        this.askedPeople.add(bookId)
        void this.sharingService.loadOwner(bookId).catch(() => this.askedPeople.delete(bookId))
      }
    })
    effect(() => {
      const more = this.more()
      observer?.disconnect()
      if (more) {
        observer?.observe(more.nativeElement)
      }
    })
    // "Fix" in the sync sheet opens this page with the rejected op's id.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const fix = params.get('fix')
      if (fix) {
        this.transactionService.openFix(fix)
        this.transferService.openFix(fix)
        void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      }
    })
  }

  /** A row opens its form; either side of a transfer opens the whole transfer (Q6). */
  protected openRow(item: EntryItem): void {
    if (item.kind === 'transfer') {
      this.transferService.open({ mode: 'edit', id: item.id })
    } else if (item.kind === 'debt') {
      // A debt entry opens on its debt's page (debt → Web screens).
      void this.router.navigate(['/wallets/debts', item.debtId], {
        queryParams: { entry: item.id },
      })
    } else {
      this.transactionService.open({ mode: 'edit', id: item.id })
    }
  }

  /** The period tabs with their labels (`09/2026 · เดือนที่แล้ว · เดือนนี้ · อนาคต`). */
  protected chips = computed(() => {
    this.languageService.language()
    const unit = this.transactionService.unit()
    const today = this.transactionService.today()
    const custom = this.transactionService.custom()
    return this.transactionService.tabs().map((tab) => {
      const result = periodLabel(unit, tab, today, custom)
      return {
        id: tab,
        label: 'key' in result ? this.transloco.translate(result.key) : result.text,
      }
    })
  })

  /** The chosen tab's place, oldest first: the list slides in from that side (`appSlide`). */
  protected tabIndex = computed(() =>
    this.transactionService.tabs().indexOf(this.transactionService.tab())
  )

  protected choose(id: number | string): void {
    this.transactionService.tab.set(id as PeriodTab)
  }

  /** A sideways swipe over the list moves to the next or previous period. */
  protected move(step: 1 | -1): void {
    const tabs = this.transactionService.tabs()
    const index = tabs.indexOf(this.transactionService.tab())
    const next = index < 0 ? undefined : tabs[index + step]
    if (next !== undefined) {
      this.transactionService.tab.set(next)
    }
  }
}

/**
 * The row's signed amount: a transaction by its category's type, a transfer by its side, a debt
 * entry by the money in its wallet.
 */
const entrySign = (item: EntryItem): number => {
  switch (item.kind) {
    case 'transfer':
      return item.side === 'in' ? item.amount : -item.amount
    case 'debt':
      return item.signed
    default:
      return signedAmount(item.amount, item.type)
  }
}
