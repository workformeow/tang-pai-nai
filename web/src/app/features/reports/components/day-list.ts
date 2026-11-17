import type { ElementRef } from '@angular/core'
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  linkedSignal,
  viewChild,
} from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCloud } from '@ng-icons/lucide'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { signedAmount, TransactionService } from '@/core/transaction'
import type { TransactionItem } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { addDays, formatAmount, fromDay } from '@/shared/utils'

/** The rows a drill-down page draws at a time (transaction.md → Volume). */
const PAGE = 100

/**
 * A report page's transactions in the Transactions tab's day cards (report.md → Web screens,
 * Q5): the big date, its words, the day's net, the rows (rule 13's order). A row opens the
 * transaction sheet. Drawn 100 rows at a time.
 */
@Component({
  selector: 'app-report-day-list',
  imports: [TranslocoPipe, NgIcon, IconBadge],
  providers: [provideIcons({ lucideCloud })],
  host: { class: 'flex flex-col gap-3' },
  templateUrl: './day-list.html',
})
export class ReportDayList {
  private transactionService = inject(TransactionService)
  private walletService = inject(WalletService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)

  items = input.required<readonly TransactionItem[]>()
  /** The wallet's badge on each row, while "ทุกกระเป๋า" shows several wallets. */
  showWallet = input(false)

  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON
  private more = viewChild<ElementRef<HTMLElement>>('more')
  private limit = linkedSignal({ source: this.items, computation: () => PAGE })
  protected hasMore = computed(() => this.items().length > this.limit())

  protected days = computed(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const all = this.items()
    const today = this.transactionService.today()
    const wallets = new Map(this.walletService.wallets().map((wallet) => [wallet.id, wallet]))
    const pending = this.transactionService.pendingIds()
    const weekday = new Intl.DateTimeFormat(locale, { weekday: 'long' })
    const monthYear = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' })
    const money = (minor: number, code: string) =>
      formatAmount(minor, this.walletService.minorUnit(code), locale, true)
    const groups: {
      day: string
      number: string
      title: string
      subtitle: string
      total: string
      items: {
        item: TransactionItem
        amount: string
        positive: boolean
        wallet: { icon: string; color: string; name: string } | null
        pending: boolean
      }[]
    }[] = []
    const sums = new Map<string, number>()
    for (const item of all) {
      sums.set(
        item.occurredOn,
        (sums.get(item.occurredOn) ?? 0) + signedAmount(item.amount, item.type)
      )
    }
    for (const item of all.slice(0, this.limit())) {
      let group = groups.at(-1)
      if (group?.day !== item.occurredOn) {
        const date = fromDay(item.occurredOn)
        group = {
          day: item.occurredOn,
          number: item.occurredOn.slice(8, 10),
          title:
            item.occurredOn === today
              ? this.transloco.translate('transactions.today')
              : item.occurredOn === addDays(today, -1)
                ? this.transloco.translate('transactions.yesterday')
                : weekday.format(date),
          subtitle: monthYear.format(date),
          // One currency per page (the report's), so one figure per day.
          total: money(sums.get(item.occurredOn) ?? 0, item.currencyCode),
          items: [],
        }
        groups.push(group)
      }
      const wallet = this.showWallet() ? wallets.get(item.walletId) : undefined
      const signed = signedAmount(item.amount, item.type)
      group.items.push({
        item,
        amount: money(signed, item.currencyCode),
        positive: signed > 0,
        wallet: wallet ? { icon: wallet.icon, color: wallet.color, name: wallet.name } : null,
        pending: pending.has(item.id),
      })
    }
    return groups
  })

  constructor() {
    // Draw the next page once the end of the list comes near.
    const observer =
      typeof IntersectionObserver === 'undefined'
        ? null
        : new IntersectionObserver(
            (entries) => {
              if (entries.some((entry) => entry.isIntersecting)) {
                this.limit.update((limit) => limit + PAGE)
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
  }

  protected open(item: TransactionItem): void {
    this.transactionService.open({ mode: 'edit', id: item.id })
  }
}
