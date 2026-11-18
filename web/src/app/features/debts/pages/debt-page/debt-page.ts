import { Component, computed, DestroyRef, effect, inject, untracked } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronRight, lucideHandCoins, lucidePencil, lucideRepeat } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import { DebtService } from '@/core/debt'
import type { DebtHistoryItem } from '@/core/debt'
import { LanguageService } from '@/core/i18n'
import { describeRepeat, RecurringService, shortDate } from '@/core/recurring'
import { PageTitleStrategy } from '@/core/routing'
import { TransactionService } from '@/core/transaction'
import { DebtSheets } from '@/features/debts/components/debt-sheets'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { formatAmount, formatMoney, fromDay } from '@/shared/utils'

/**
 * A debt's page (docs/features/debt.md → Web screens, mock-up frames 5, 7, 9): what is left, the
 * bar, paid / total, due, how it counts; the instalments to come (its rules); repay / borrow more
 * / close; the history, newest first, each row opening its sheet. Its title is the person.
 */
@Component({
  selector: 'app-debt-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, EmptyState, IconBadge, DebtSheets],
  providers: [provideIcons({ lucideChevronRight, lucideHandCoins, lucidePencil, lucideRepeat })],
  templateUrl: './debt-page.html',
})
export class DebtPage {
  protected debtService = inject(DebtService)
  protected recurringService = inject(RecurringService)
  private transactionService = inject(TransactionService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private pageTitleStrategy = inject(PageTitleStrategy)
  private activatedRoute = inject(ActivatedRoute)
  private router = inject(Router)

  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON
  private params = toSignal(this.activatedRoute.paramMap, {
    initialValue: this.activatedRoute.snapshot.paramMap,
  })
  private id = computed(() => this.params().get('id') ?? '')
  protected item = computed(() => this.debtService.item(this.id()))

  private money = (minor: number) => {
    const item = this.item()
    return item
      ? formatMoney(minor, item.debt.currencyCode, item.minorUnit, this.languageService.locale())
      : ''
  }
  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)

  protected heroLabel = computed(() => {
    this.languageService.language()
    const item = this.item()
    if (!item) {
      return ''
    }
    if (item.closed) {
      return this.t('debts.closedLabel')
    }
    if (item.left < 0) {
      return this.t('debts.overpaid')
    }
    return this.t(
      item.debt.countAs === 'repaid' ? 'debts.leftRepaid' : `debts.leftOf.${item.debt.direction}`
    )
  })
  protected leftText = computed(() => {
    const item = this.item()
    return item ? this.money(item.closed ? item.total : Math.abs(item.left)) : ''
  })
  protected share = computed(() => {
    const item = this.item()
    return item && item.total > 0 ? Math.min(100, Math.round((100 * item.paid) / item.total)) : 0
  })
  protected facts = computed(() => {
    this.languageService.language()
    const item = this.item()
    if (!item) {
      return []
    }
    const { debt } = item
    const locale = this.languageService.locale()
    const today = this.transactionService.today()
    const lines: { text: string; warn: boolean }[] = [
      {
        text:
          debt.countAs === 'repaid'
            ? this.t('debts.instalmentsPaid', {
                count: item.instalments,
                paid: this.money(item.paid),
              }) + this.t('debts.ofTotal', { total: this.money(item.total) })
            : this.t(`debts.paidOf.${debt.direction}`, {
                paid: this.money(item.paid),
                total: this.money(item.total),
              }),
        warn: false,
      },
    ]
    if (item.interest > 0) {
      lines.push({
        text: this.t(`debts.interestTotal.${debt.direction}`, {
          amount: this.money(item.interest),
        }),
        warn: false,
      })
    }
    if (item.closed && item.lastOn) {
      lines.push({
        text: this.t(item.forgiven ? 'debts.closedForgiven' : 'debts.closedPaid', {
          date: shortDate(item.lastOn, locale),
        }),
        warn: false,
      })
    } else if (debt.dueOn) {
      const days = Math.round(
        (fromDay(debt.dueOn).getTime() - fromDay(today).getTime()) / 86_400_000
      )
      lines.push({
        text: this.t(item.overdue ? 'debts.overdueLine' : 'debts.dueLine', {
          date: shortDate(debt.dueOn, locale),
          days: Math.abs(days),
        }),
        warn: item.overdue,
      })
    }
    lines.push({
      text: [debt.note, this.t(`debts.countLine.${debt.countAs}`)].filter((x) => x).join(' · '),
      warn: false,
    })
    return lines
  })
  /** The debt's instalments to come (debt rule 13). */
  protected rules = computed(() => {
    this.languageService.language()
    const item = this.item()
    if (!item) {
      return []
    }
    const locale = this.languageService.locale()
    return this.debtService
      .rules(item.debt.id)
      .map((id) => this.recurringService.byId(id))
      .filter((rule) => rule !== null)
      .map((rule) => {
        const state = this.recurringService.itemOf(rule).state
        const left =
          rule.endCount !== null && rule.nextOn
            ? rule.endCount - this.recurringService.recordedCount(rule)
            : null
        return {
          id: rule.id,
          title: rule.nextOn
            ? this.t('debts.nextInstalment', { date: shortDate(rule.nextOn, locale) })
            : this.t('recurring.ended'),
          sub: [
            describeRepeat(rule, rule.startOn, this.t, locale),
            left !== null && left > 0 ? this.t('debts.instalmentsLeft', { count: left }) : '',
            state === 'paused'
              ? this.t('recurring.paused')
              : state === 'stopped'
                ? this.t('debts.ruleStopped')
                : this.t(rule.confirm ? 'recurring.ask' : 'recurring.auto'),
          ]
            .filter((part) => part)
            .join(' · '),
          amount: formatAmount(
            item.debt.direction === 'lent' ? rule.amount : -rule.amount,
            item.minorUnit,
            locale,
            true
          ),
        }
      })
  })
  protected history = computed(() => {
    this.languageService.language()
    const item = this.item()
    if (!item) {
      return []
    }
    const locale = this.languageService.locale()
    const day = (on: string) => shortDate(on, locale)
    const rows = this.debtService.history(item.debt.id)
    const settles = rows.filter((row) => row.kind === 'transaction' && row.settles).reverse()
    return rows.map((row) => {
      if (row.kind === 'entry') {
        const { entry } = row
        return {
          item: row,
          title: this.t(`debts.entry.${item.debt.direction}.${entry.kind}`),
          tag: '',
          sub: [
            day(entry.occurredOn),
            entry.walletId
              ? this.t(`debts.walletShort.${row.signed > 0 ? 'in' : 'out'}`, {
                  name: row.walletName,
                })
              : this.t(entry.kind === 'principal' ? 'debts.noCashIn' : 'debts.forgivenRest'),
            entry.note,
          ]
            .filter((part) => part)
            .join(' · '),
          sign: entry.walletId ? Math.sign(row.signed) : 0,
          amount: formatAmount(
            entry.walletId ? row.signed : entry.amount,
            item.minorUnit,
            locale,
            entry.walletId !== null
          ),
          wallet: entry.walletId ? { icon: row.walletIcon, color: row.walletColor } : null,
        }
      }
      const number = row.settles ? settles.indexOf(row) + 1 : 0
      return {
        item: row,
        title: row.categoryName,
        tag: this.t(row.type === 'income' ? 'categories.income' : 'categories.expense'),
        sub: [
          day(row.occurredOn),
          row.walletName,
          number > 0 && item.debt.countAs === 'repaid'
            ? this.t('debts.instalmentNo', { n: number })
            : '',
          row.note,
        ]
          .filter((part) => part)
          .join(' · '),
        sign: row.type === 'income' ? 1 : -1,
        amount: formatAmount(
          row.type === 'income' ? row.amount : -row.amount,
          item.minorUnit,
          locale,
          true
        ),
        wallet: { icon: row.walletIcon, color: row.walletColor },
      }
    })
  })
  protected repayLabel = computed(() => {
    const debt = this.item()?.debt
    return debt?.countAs === 'repaid' ? 'debts.payInstalment' : `debts.repay.${debt?.direction}`
  })

  constructor() {
    effect(() => {
      const person = this.item()?.debt.person ?? null
      untracked(() => this.pageTitleStrategy.setOverride(person))
    })
    inject(DestroyRef).onDestroy(() => this.pageTitleStrategy.setOverride(null))
    // A row of the Transactions tab (?entry=) or a repayment rule (?rule=) opens its sheet here.
    this.activatedRoute.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const entry = params.get('entry')
      const rule = params.get('rule')
      if (entry) {
        this.debtService.openEntry({ mode: 'edit', id: entry })
      } else if (rule) {
        this.debtService.openEntry({ mode: 'rule', id: rule })
      }
      if (entry || rule) {
        void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      }
    })
  }

  protected repay(): void {
    const item = this.item()
    if (!item) {
      return
    }
    if (item.debt.countAs !== 'repaid') {
      this.debtService.openEntry({ mode: 'create', debtId: item.debt.id, kind: 'repayment' })
      return
    }
    // An instalment is an ordinary expense in the debt's category (debt rule 3).
    const rule = this.debtService
      .rules(item.debt.id)
      .map((id) => this.recurringService.byId(id))
      .find((found) => found !== null)
    this.transactionService.open({
      mode: 'create',
      type: 'expense',
      values: {
        walletId: rule?.walletId ?? this.transactionService.defaultWalletId() ?? '',
        categoryId: item.debt.categoryId ?? '',
        amount: rule?.amount ?? Math.max(0, item.left),
        occurredOn: this.transactionService.today(),
        note: '',
        excludeFromReport: false,
        debtId: item.debt.id,
      },
    })
  }

  protected more(): void {
    const item = this.item()
    if (item) {
      this.debtService.openEntry({ mode: 'create', debtId: item.debt.id, kind: 'principal' })
    }
  }

  protected openRow(row: DebtHistoryItem): void {
    if (row.kind === 'entry') {
      this.debtService.openEntry({ mode: 'edit', id: row.id })
    } else {
      this.transactionService.open({ mode: 'edit', id: row.id })
    }
  }
}
