import { Component, computed, ElementRef, inject, input, signal, viewChild } from '@angular/core'
import { Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArrowLeftRight,
  lucideCalendarRange,
  lucideCheck,
  lucideChevronDown,
  lucideChevronLeft,
  lucideActivity,
  lucideChevronRight,
  lucideCoins,
  lucideEllipsisVertical,
  lucideHandCoins,
  lucidePlane,
  lucideRepeat,
  lucideWallet,
} from '@ng-icons/lucide'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { REPORT_UNITS, ReportService } from '@/core/report'
import type { ReportUnit } from '@/core/report'
import {
  activityDaysLeft,
  activityLeftText,
  PERIOD_UNITS,
  TransactionService,
  TransferService,
} from '@/core/transaction'
import type { PeriodUnit } from '@/core/transaction'
import { BookSwitcher } from '@/layout/book-switcher/book-switcher'
import { SyncStatus } from '@/layout/sync-status/sync-status'
import { IconBadge } from '@/shared/components/icon-badge'
import { Slide } from '@/shared/components/slide'

/**
 * The Transactions tab's header (transaction.md → Web screens; owner's choice in #8): the
 * book switcher on the left, the wallet switcher in the very centre, the sync icon and the ⋮
 * menu on the right; both sides are the same width so the switcher stays centred. The menu is a
 * two-level list (transfer.md → Web screens, owner's choice B in #9): "โอนเงิน" and "ดูตาม ›",
 * which turns the menu into the units. The Reports tab uses it too (report.md Q2–Q3): the same
 * wallet, its own units (month, quarter, year, custom) and no "โอนเงิน".
 */
@Component({
  selector: 'app-transactions-header',
  imports: [TranslocoPipe, NgIcon, IconBadge, BookSwitcher, SyncStatus, Slide],
  // The menu grows from the ⋮ (its top right) and fades; under reduced motion it only fades
  // (DESIGN.md §8).
  styleUrl: './transactions-header.css',
  providers: [
    provideIcons({
      lucideActivity,
      lucideArrowLeftRight,
      lucideCalendarRange,
      lucideCheck,
      lucideChevronDown,
      lucideChevronLeft,
      lucideChevronRight,
      lucideCoins,
      lucideEllipsisVertical,
      lucideHandCoins,
      lucidePlane,
      lucideRepeat,
      lucideWallet,
    }),
  ],
  host: {
    class: 'relative grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-1 pr-1 pl-2',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'closeMenu(true)',
  },
  templateUrl: './transactions-header.html',
})
export class TransactionsHeader {
  protected bookService = inject(BookService)
  protected transactionService = inject(TransactionService)
  private transferService = inject(TransferService)
  protected reportService = inject(ReportService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)
  private router = inject(Router)

  /** Which tab it heads: the Transactions tab's menu, or the Reports tab's (report.md Q2). */
  view = input<'transactions' | 'reports'>('transactions')
  protected units = computed<readonly PeriodUnit[]>(() =>
    this.view() === 'reports' ? REPORT_UNITS : PERIOD_UNITS
  )
  protected currentUnit = computed<PeriodUnit>(() =>
    this.view() === 'reports' ? this.reportService.unit() : this.transactionService.unit()
  )
  protected walletName = computed(() => {
    this.languageService.language()
    return (
      this.transactionService.viewWallet()?.name ??
      this.transloco.translate('transactions.allWallets')
    )
  })

  protected menuOpen = signal(false)
  /** The menu's level: its items, or the units of "ดูตาม". */
  protected level = signal<'main' | 'units'>('main')
  private menuButton = viewChild.required<ElementRef<HTMLElement>>('menuButton')
  private menu = viewChild<ElementRef<HTMLElement>>('menu')
  private host = inject<ElementRef<HTMLElement>>(ElementRef)

  protected toggleMenu(): void {
    if (this.menuOpen()) {
      this.closeMenu(false)
      return
    }
    this.level.set('main')
    this.menuOpen.set(true)
    this.focusIn('[role="menuitem"]')
  }

  protected showUnits(): void {
    this.level.set('units')
    // Focus the chosen unit, like a native menu.
    this.focusIn('[aria-checked="true"]')
  }

  protected showMain(): void {
    this.level.set('main')
    this.focusIn('[aria-haspopup="menu"]')
  }

  protected transfer(): void {
    this.closeMenu(false)
    this.transferService.open({ mode: 'create' })
  }

  protected debts(): void {
    this.closeMenu(false)
    void this.router.navigateByUrl('/wallets/debts')
  }

  protected events(): void {
    this.closeMenu(false)
    void this.router.navigateByUrl('/transactions/events')
  }

  protected recurring(): void {
    this.closeMenu(false)
    void this.router.navigateByUrl('/account/recurring')
  }

  protected currencies(): void {
    this.closeMenu(false)
    void this.router.navigateByUrl('/reports/currencies')
  }

  protected activity(): void {
    this.closeMenu(false)
    void this.router.navigateByUrl('/transactions/activity')
  }

  /** "เหลือ n วัน" on the menu item in the last week of an ended share (shared-activity rule 7). */
  protected activityLeft = computed(() => {
    this.languageService.language()
    const scope = this.transactionService.activityScope()
    const days = scope?.ended ? activityDaysLeft(scope.expiresAt) : null
    return days === null || days > 7 ? null : activityLeftText(days, this.t)
  })

  protected closeMenu(refocus: boolean): void {
    if (!this.menuOpen()) {
      return
    }
    this.menuOpen.set(false)
    if (refocus) {
      this.menuButton().nativeElement.focus()
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    // The path, not `contains`: a level switch has already removed the item that was tapped.
    if (this.menuOpen() && !event.composedPath().includes(this.host.nativeElement)) {
      this.closeMenu(false)
    }
  }

  /**
   * ↑ / ↓ move between the items, Home / End to the ends, → opens "ดูตาม", ← goes back, Tab
   * leaves (menu pattern).
   */
  protected onMenuKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' && this.level() === 'main') {
      event.preventDefault()
      this.showUnits()
      return
    }
    if (event.key === 'ArrowLeft' && this.level() === 'units') {
      event.preventDefault()
      this.showMain()
      return
    }
    const items = [
      ...(this.menu()?.nativeElement.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []),
    ]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const moves: Record<string, number> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: items.length - 1,
    }
    if (event.key in moves) {
      event.preventDefault()
      items.at(moves[event.key] % items.length)?.focus()
    } else if (event.key === 'Tab') {
      this.closeMenu(false)
    }
  }

  protected choose(unit: PeriodUnit): void {
    this.closeMenu(true)
    if (this.view() === 'reports') {
      if (unit === 'custom') {
        this.reportService.customSheet.set(true)
      } else {
        this.reportService.selectUnit(unit as ReportUnit)
      }
      return
    }
    if (unit === 'custom') {
      this.transactionService.customSheet.set(true)
      return
    }
    this.transactionService.selectUnit(unit)
  }

  private focusIn(selector: string): void {
    setTimeout(() => this.menu()?.nativeElement.querySelector<HTMLElement>(selector)?.focus())
  }
}
