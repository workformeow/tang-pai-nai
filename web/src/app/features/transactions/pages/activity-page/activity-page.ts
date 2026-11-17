import { NgTemplateOutlet } from '@angular/common'
import type { ElementRef } from '@angular/core'
import { Component, computed, DestroyRef, effect, inject, signal, viewChild } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideClock } from '@ng-icons/lucide'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { SharingService } from '@/core/sharing'
import {
  activityDaysLeft,
  activityLeftText,
  signedAmount,
  TransactionService,
} from '@/core/transaction'
import type { ActivityItem } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { USER_COLORS } from '@/shared/components/icon-badge'
import { formatAmount, toDay } from '@/shared/utils'

/** One line of the page, ready to draw. */
interface ActivityLine {
  id: string
  /** A live row opens its transaction (rule 10); a deleted one doesn't. */
  live: boolean
  initial: string
  /** The person's colour; null for a former member (muted). */
  color: string | null
  who: string
  what: string
  category: string
  detail: string
  amount: string
  positive: boolean
}

interface ActivityDay {
  key: string
  label: string
  lines: ActivityLine[]
}

/**
 * ⋮ → กิจกรรม (docs/features/shared-activity.md): who added, edited or deleted which transaction
 * in the book's shared wallets over the last 90 days, newest first, by day.
 */
@Component({
  selector: 'app-activity-page',
  imports: [TranslocoPipe, NgIcon, NgTemplateOutlet],
  providers: [provideIcons({ lucideClock })],
  templateUrl: './activity-page.html',
})
export class ActivityPage {
  private transactionService = inject(TransactionService)
  private walletService = inject(WalletService)
  private bookService = inject(BookService)
  private sharingService = inject(SharingService)
  private networkStatusService = inject(NetworkStatusService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private more = viewChild<ElementRef<HTMLElement>>('more')
  private readonly PAGE = 100
  /** Lines drawn so far (rule 11), 100 more as the end comes near. */
  private limit = signal(this.PAGE)
  /** Books whose members were asked for (names, rule 5), once per visit. */
  private asked = new Set<string>()

  private items = computed<ActivityItem[]>(() => {
    const scope = this.transactionService.activityScope()
    return scope ? this.transactionService.activity(scope) : []
  })
  protected hasMore = computed(() => this.items().length > this.limit())

  /** The ended-share line: "ดูกิจกรรมได้ถึง <date>", with the days left in the last week. */
  protected ended = computed(() => {
    this.languageService.language()
    const scope = this.transactionService.activityScope()
    if (!scope?.ended || scope.expiresAt === null) {
      return null
    }
    const date = new Intl.DateTimeFormat(this.languageService.locale(), {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(scope.expiresAt)
    const until = this.t('activity.until', { date })
    const days = activityDaysLeft(scope.expiresAt)
    return days !== null && days <= 7 ? `${until} (${activityLeftText(days, this.t)})` : until
  })

  protected days = computed<ActivityDay[]>(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const people = this.transactionService.people()
    const today = this.transactionService.today()
    const yesterday = toDay(new Date(Date.now() - 24 * 60 * 60 * 1000))
    const dayLabel = new Intl.DateTimeFormat(locale, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })
    const time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' })
    const groups: ActivityDay[] = []
    for (const item of this.items().slice(0, this.limit())) {
      const at = new Date(item.updatedAt)
      const key = toDay(at)
      let group = groups.at(-1)
      if (group?.key !== key) {
        const date = dayLabel.format(at)
        const label =
          key === today
            ? `${this.t('activity.today')} · ${date}`
            : key === yesterday
              ? `${this.t('activity.yesterday')} · ${date}`
              : date
        group = { key, label, lines: [] }
        groups.push(group)
      }
      group.lines.push(this.line(item, people, time))
    }
    return groups
  })

  constructor() {
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
    // Rules 1 and 5: an own book's members (names, shared wallets), read when online.
    effect(() => {
      const bookId = this.bookService.currentId()
      if (!bookId || this.bookService.isShared() || !this.networkStatusService.isOnline()) {
        return
      }
      if (!this.asked.has(bookId)) {
        this.asked.add(bookId)
        void this.sharingService.loadOwner(bookId).catch(() => this.asked.delete(bookId))
      }
    })
  }

  protected open(id: string): void {
    this.transactionService.open({ mode: 'edit', id })
  }

  private line(
    item: ActivityItem,
    people: ReadonlyMap<string, string>,
    time: Intl.DateTimeFormat
  ): ActivityLine {
    const known = item.actor === null ? true : people.has(item.actor)
    const who =
      item.actor === null
        ? this.t('activity.you')
        : (people.get(item.actor) ?? this.t('sharing.member'))
    const minorUnit = this.walletService.minorUnit(item.currencyCode)
    const amount = signedAmount(item.amount, item.type)
    const detail = [item.note, item.walletName, time.format(item.updatedAt)].filter(Boolean)
    return {
      id: item.id,
      live: item.action !== 'deleted',
      initial: [...who.trim()].at(0)?.toUpperCase() ?? '',
      color: known ? personColor(item.actor ?? 'me') : null,
      who,
      what: this.t(`activity.${item.action}`),
      category: item.categoryName,
      detail: detail.join(' · '),
      amount: formatAmount(amount, minorUnit, this.languageService.locale(), true),
      positive: amount > 0,
    }
  }

  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)
}

/** A steady colour per person (rule 3, owner 2026-11: one colour each reads at a glance). */
const personColor = (id: string): string => {
  let hash = 0
  for (const char of id) {
    hash = (hash * 31 + char.charCodeAt(0)) | 0
  }
  return USER_COLORS[Math.abs(hash) % USER_COLORS.length] ?? USER_COLORS[0]
}
