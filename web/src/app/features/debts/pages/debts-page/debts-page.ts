import { Component, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronDown, lucideHandCoins } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import { DEBTS_ROUTE, DebtService } from '@/core/debt'
import type { DebtDirection } from '@/core/debt'
import { LanguageService } from '@/core/i18n'
import { DebtSheets } from '@/features/debts/components/debt-sheets'
import { debtRow } from '@/features/debts/debt-view'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { formatMoney } from '@/shared/utils'

/**
 * ยืม-คืน (docs/features/debt.md → Web screens, mock-up frames 2 and 10): ยืมมา | ให้ยืม,
 * what is left in total, the open debts by due date, "ปิดแล้ว (n)" folded, and "บันทึกหนี้".
 */
@Component({
  selector: 'app-debts-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, RouterLink, EmptyState, IconBadge, DebtSheets],
  providers: [provideIcons({ lucideChevronDown, lucideHandCoins })],
  templateUrl: './debts-page.html',
})
export class DebtsPage {
  protected debtService = inject(DebtService)
  private categoryService = inject(CategoryService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private activatedRoute = inject(ActivatedRoute)
  private router = inject(Router)

  protected readonly directions: readonly DebtDirection[] = ['borrowed', 'lent']
  protected readonly route = DEBTS_ROUTE
  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected tab = signal<DebtDirection>('borrowed')
  protected showClosed = signal(false)

  private rows = computed(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params)
    return this.debtService
      .items()
      .filter((item) => item.debt.direction === this.tab())
      .map((item) => debtRow(item, t, locale))
  })
  protected open = computed(() => this.rows().filter((row) => !row.item.closed))
  protected closed = computed(() =>
    this.rows()
      .filter((row) => row.item.closed)
      .sort((a, b) => (b.item.lastOn ?? '').localeCompare(a.item.lastOn ?? ''))
  )
  /** What is left of the open debts, one line per currency. */
  protected totals = computed(() => {
    const locale = this.languageService.locale()
    const sums = new Map<string, { amount: number; minorUnit: number }>()
    for (const row of this.open()) {
      const { debt, left, minorUnit } = row.item
      const sum = sums.get(debt.currencyCode) ?? { amount: 0, minorUnit }
      sum.amount += Math.max(0, left)
      sums.set(debt.currencyCode, sum)
    }
    if (sums.size === 0) {
      sums.set('THB', { amount: 0, minorUnit: 2 })
    }
    return [...sums.entries()].map(([code, sum]) => ({
      code,
      text: formatMoney(sum.amount, code, sum.minorUnit, locale),
    }))
  })

  constructor() {
    this.activatedRoute.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const tab = params.get('tab')
      if (tab === 'lent' || tab === 'borrowed') {
        this.tab.set(tab)
      }
      const fix = params.get('fix')
      if (fix) {
        this.debtService.openFix(fix)
        void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      }
    })
  }

  protected countOf(direction: DebtDirection): number {
    return this.debtService.openItems().filter((item) => item.debt.direction === direction).length
  }

  protected categoryOf(id: string | null) {
    return id ? this.categoryService.byId(id) : null
  }

  protected choose(direction: DebtDirection): void {
    this.tab.set(direction)
    void this.router.navigate([], {
      queryParams: { tab: direction === 'lent' ? 'lent' : null },
      replaceUrl: true,
    })
  }
}
