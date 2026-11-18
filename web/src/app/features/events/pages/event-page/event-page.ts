import { Component, computed, DestroyRef, effect, inject, signal, untracked } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { ActivatedRoute } from '@angular/router'
import { map } from 'rxjs'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck, lucidePencil, lucidePlus, lucideRotateCcw } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import { EventService } from '@/core/event'
import { LanguageService } from '@/core/i18n'
import { PageTitleStrategy } from '@/core/routing'
import { TransactionService } from '@/core/transaction'
import type { TransactionItem } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { EventSheet } from '@/features/events/components/event-sheet'
import { counted, eventDates } from '@/features/events/event-view'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { formatAmount, formatMoney, fromDay } from '@/shared/utils'

/** Rows drawn at a time ("แสดงเพิ่ม"), like the Transactions tab's pages of 100. */
const PAGE = 100

/**
 * An event's page (docs/features/event.md → Web screens 2, mock-up frame 2): its expense, income
 * and net (event rule 4), "จบทริป" / "เปิดอีกครั้ง" and "เพิ่มรายการ", the expense by category,
 * then its rows by day (tap = the transaction sheet).
 */
@Component({
  selector: 'app-event-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, EmptyState, IconBadge, EventSheet],
  providers: [provideIcons({ lucideCheck, lucidePencil, lucidePlus, lucideRotateCcw })],
  templateUrl: './event-page.html',
})
export class EventPage {
  protected eventService = inject(EventService)
  protected transactionService = inject(TransactionService)
  private walletService = inject(WalletService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private pageTitleStrategy = inject(PageTitleStrategy)

  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON
  protected readonly page = PAGE
  protected shown = signal(PAGE)

  private id = toSignal(inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('id'))), {
    initialValue: null,
  })
  protected item = computed(() => {
    const id = this.id()
    return id ? this.eventService.item(id) : null
  })
  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)

  protected heroLabel = computed(() => {
    this.languageService.language()
    const event = this.item()?.event
    return event
      ? `${this.t('events.spent')} · ${eventDates(event, this.t, this.languageService.locale())}`
      : ''
  })
  /** Event rule 4, one line per currency ("0.00" before the first row). */
  protected money = computed(() => {
    const locale = this.languageService.locale()
    const lines = this.item()?.money ?? []
    const shown = lines.length
      ? lines
      : [{ currencyCode: 'THB', minorUnit: 2, income: 0, expense: 0, net: 0 }]
    return shown.map((line) => ({
      code: line.currencyCode,
      expense: formatMoney(line.expense, line.currencyCode, line.minorUnit, locale),
      income: formatAmount(line.income, line.minorUnit, locale, true),
      net: formatAmount(line.net, line.minorUnit, locale, true),
      positive: line.net >= 0,
    }))
  })
  protected facts = computed(() => {
    this.languageService.language()
    const item = this.item()
    if (!item) {
      return ''
    }
    return [
      counted(this.t, 'rows', item.count),
      counted(this.t, 'wallets', item.walletCount),
      ...(item.event.isClosed ? [this.t('events.closedTag')] : []),
    ].join(' · ')
  })
  protected shares = computed(() => {
    const id = this.item()?.event.id
    if (!id) {
      return []
    }
    const locale = this.languageService.locale()
    const shares = this.eventService.byCategory(id)
    const totals = new Map<string, number>()
    for (const share of shares) {
      totals.set(share.currencyCode, (totals.get(share.currencyCode) ?? 0) + share.amount)
    }
    return shares.map((share) => {
      const total = totals.get(share.currencyCode) ?? 0
      return {
        key: `${share.categoryId}:${share.currencyCode}`,
        name: share.name,
        icon: share.icon,
        color: share.color,
        amount: formatAmount(share.amount, share.minorUnit, locale),
        percent: total > 0 ? Math.round((share.amount / total) * 100) : 0,
      }
    })
  })
  /** The event's rows (all its dates, every wallet), newest first. */
  protected rows = computed<TransactionItem[]>(() => {
    const id = this.item()?.event.id
    return id ? this.transactionService.list({ from: null, to: null }, null, { eventId: id }) : []
  })
  protected days = computed(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const groups: {
      day: string
      date: string
      title: string
      subtitle: string
      total: string
      rows: {
        item: TransactionItem
        sub: string
        amount: string
        wallet: { icon: string; color: string } | null
      }[]
    }[] = []
    const sums = new Map<string, number>()
    for (const item of this.rows().slice(0, this.shown())) {
      const minorUnit = this.walletService.minorUnit(item.currencyCode)
      const signed = item.type === 'income' ? item.amount : -item.amount
      let group = groups.at(-1)
      if (group?.day !== item.occurredOn) {
        const date = fromDay(item.occurredOn)
        group = {
          day: item.occurredOn,
          date: String(date.getDate()).padStart(2, '0'),
          title: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
          subtitle: new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(
            date
          ),
          total: '',
          rows: [],
        }
        groups.push(group)
      }
      sums.set(item.occurredOn, (sums.get(item.occurredOn) ?? 0) + signed)
      group.total = formatAmount(sums.get(item.occurredOn) ?? 0, minorUnit, locale, true)
      const wallet = this.walletService.byId(item.walletId)
      group.rows.push({
        item,
        sub: [item.walletName, item.note].filter((part) => part).join(' · '),
        amount: formatAmount(signed, minorUnit, locale, true),
        wallet: wallet ? { icon: wallet.icon, color: wallet.color } : null,
      })
    }
    return groups
  })

  constructor() {
    effect(() => {
      const name = this.item()?.event.name ?? null
      untracked(() => this.pageTitleStrategy.setOverride(name))
    })
    inject(DestroyRef).onDestroy(() => this.pageTitleStrategy.setOverride(null))
  }

  protected setClosed(closed: boolean): void {
    const id = this.item()?.event.id
    if (!id) {
      return
    }
    if (!this.eventService.setClosed(id, closed)) {
      toast.error(this.t('events.limit'))
      return
    }
    toast.success(this.t(closed ? 'events.closed' : 'events.reopened'))
  }

  /** "เพิ่มรายการ": the transaction form, tagged to this event (event rule 5). */
  protected add(id: string): void {
    this.transactionService.open({ mode: 'create', eventId: id })
  }
}
