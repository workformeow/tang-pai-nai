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
  lucideBell,
  lucideChevronRight,
  lucideCreditCard,
  lucideReceiptText,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { AuthStore } from '@/core/auth'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { RecurringService, ruleTitle, shortDate } from '@/core/recurring'
import { SharingService } from '@/core/sharing'
import {
  FUTURE,
  latestAction,
  periodLabel,
  TransactionService,
  TransferService,
  ActivityService,
} from '@/core/transaction'
import type { EntryItem, PeriodTab } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { DueSheet } from '@/features/transactions/components/due-sheet'
import { EntryRow } from '@/features/transactions/components/entry-row'
import { UpcomingRow } from '@/features/transactions/components/upcoming-row'
import { addDayTotals, addUpcoming, groupByDay } from '@/features/transactions/day-groups'
import type { DayContext, DayGroup } from '@/features/transactions/day-groups'
import { EmptyState } from '@/shared/components/empty-state'
import { MoneySummaryCard } from '@/shared/components/money-summary'
import type { MoneySummaryLine } from '@/shared/components/money-summary'
import { PeriodStrip, Swipe } from '@/shared/components/period'
import { Slide } from '@/shared/components/slide'
import { formatAmount, formatMoney } from '@/shared/utils'

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
    MoneySummaryCard,
    PeriodStrip,
    Swipe,
    Slide,
    DueSheet,
    EntryRow,
    UpcomingRow,
  ],
  providers: [
    provideIcons({ lucideBell, lucideChevronRight, lucideCreditCard, lucideReceiptText }),
  ],
  host: { class: 'flex flex-col overflow-x-clip' },
  templateUrl: './transactions-page.html',
})
export class TransactionsPage {
  protected transactionService = inject(TransactionService)
  private transferService = inject(TransferService)
  private activityService = inject(ActivityService)
  protected recurringService = inject(RecurringService)
  private walletService = inject(WalletService)
  private bookService = inject(BookService)
  private authStore = inject(AuthStore)
  private sharingService = inject(SharingService)
  private networkStatusService = inject(NetworkStatusService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)

  // ── Balance, the card owed, the due bills ──────────────────────────────────

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
        (occurrence) =>
          `${ruleTitle(occurrence.item, this.t)} ${shortDate(occurrence.on, locale, false)}`
      )
      .join(' · ')
    return { count: due.length, text }
  })
  /** The due bills' sheet. */
  protected dueOpen = signal(false)

  // ── The period tabs ────────────────────────────────────────────────────────

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
        label: 'key' in result ? this.t(result.key) : result.text,
      }
    })
  })
  /** The chosen tab's place, oldest first: the list slides in from that side (`appSlide`). */
  protected tabIndex = computed(() =>
    this.transactionService.tabs().indexOf(this.transactionService.tab())
  )

  // ── The period: its summary and its days ───────────────────────────────────

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
  /** The period's rows (one page of them at a time) grouped by day, newest first. */
  protected days = computed<DayGroup[]>(() => {
    this.languageService.language()
    const all = this.transactionService.items()
    const context = this.dayContext(all)
    const pending = this.transactionService.pendingIds()
    const groups = groupByDay(all.slice(0, this.limit()), context, (item) => {
      const waiting = pending.has(item.id)
      return { pending: waiting, touchedBy: this.touchedBy(item, waiting) }
    })
    addDayTotals(groups, all, context.money)
    if (this.transactionService.tab() !== FUTURE) {
      return groups
    }
    const walletIds = this.transactionService.viewWalletIds()
    const upcoming = this.recurringService.upcoming(this.transactionService.range(), walletIds)
    return addUpcoming(groups, upcoming, walletIds, context)
  })

  // ── One page of rows at a time ─────────────────────────────────────────────

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
  /** The mark at the end of the list that draws the next page. */
  private more = viewChild<ElementRef<HTMLElement>>('more')

  /** Books whose members were asked for, for "เพิ่มโดย …" (sharing rule 15). */
  private askedPeople = new Set<string>()

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
    effect(() => {
      const more = this.more()
      observer?.disconnect()
      if (more) {
        observer?.observe(more.nativeElement)
      }
    })
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

  // ── Template actions ───────────────────────────────────────────────────────

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

  protected payCard(id: string): void {
    this.transferService.pay(id)
  }

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

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** How the day cards write money, days and wallets for `all` the period's rows. */
  private dayContext(all: readonly EntryItem[]): DayContext {
    const locale = this.languageService.locale()
    // The symbol is left out while every row shares one currency.
    const mixed = new Set(all.map((item) => item.currencyCode)).size > 1
    const showWallet = this.transactionService.viewWallet() === null
    const wallets = new Map(this.walletService.wallets().map((wallet) => [wallet.id, wallet]))
    return {
      locale,
      today: this.transactionService.today(),
      t: this.t,
      money: (minor, code) => {
        const minorUnit = this.walletService.minorUnit(code)
        return mixed
          ? formatMoney(minor, code, minorUnit, locale)
          : formatAmount(minor, minorUnit, locale, true)
      },
      walletOf: (id) => {
        const wallet = showWallet ? wallets.get(id) : undefined
        return wallet ? { icon: wallet.icon, color: wallet.color, name: wallet.name } : null
      },
    }
  }

  /**
   * Shared-activity rule 6: "แก้ไขโดย …" when someone else edited the row last, else "เพิ่มโดย …"
   * when someone else added it; null for rows you wrote. A name once read, else "อดีตสมาชิก".
   */
  private touchedBy(item: EntryItem, pending: boolean): string | null {
    if (item.kind !== 'transaction' || pending) {
      return null
    }
    const me = this.authStore.user()?.id ?? null
    const ownerId = this.bookService.shared()?.owner.id ?? me
    const name = (id: string) => this.activityService.people().get(id) ?? this.t('sharing.member')
    const { action, actor } = latestAction(item, ownerId, me)
    if (action === 'edited' && actor) {
      return this.t('activity.editedBy', { name: name(actor) })
    }
    const adder = item.addedBy ?? ownerId
    return adder && adder !== me ? this.t('sharing.addedBy', { name: name(adder) }) : null
  }

  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)
}
