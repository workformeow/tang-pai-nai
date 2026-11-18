import { Component, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArrowLeftRight,
  lucideHandCoins,
  lucideChevronDown,
  lucideCircleAlert,
  lucideRepeat,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { SyncService } from '@/core/offline'
import { describeRepeat, RecurringService, ruleTitle, shortDate } from '@/core/recurring'
import type { RuleItem } from '@/core/recurring'
import { TransactionService, TransferService } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { formatAmount } from '@/shared/utils'

interface RuleRow {
  item: RuleItem
  title: string
  note: string
  schedule: string
  /** Why it records nothing now, in the destructive colour (recurring rule 12). */
  warning: string
  amount: string
}

/**
 * Account › รายการซ้ำ (docs/features/recurring.md → Web screens, mock-up frames 5 and 7): the
 * current book's rules, "ใช้อยู่" by next date, "หยุดไว้" (paused, or stopped by an archived
 * wallet or category), then "สิ้นสุดแล้ว" folded. A row opens the rule in its sheet.
 */
@Component({
  selector: 'app-recurring-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, EmptyState, IconBadge],
  providers: [
    provideIcons({
      lucideArrowLeftRight,
      lucideChevronDown,
      lucideCircleAlert,
      lucideHandCoins,
      lucideRepeat,
    }),
  ],
  templateUrl: './recurring-page.html',
})
export class RecurringPage {
  protected recurringService = inject(RecurringService)
  protected walletService = inject(WalletService)
  private transactionService = inject(TransactionService)
  private transferService = inject(TransferService)
  private syncService = inject(SyncService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private route = inject(ActivatedRoute)
  private router = inject(Router)

  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON
  protected showEnded = signal(false)

  protected rows = computed<RuleRow[]>(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params)
    return this.recurringService.items().map((item) => {
      const { rule } = item
      const minorUnit = this.walletService.minorUnit(item.currencyCode)
      const parts = [describeRepeat(rule, rule.startOn, t, locale)]
      if (rule.endCount !== null) {
        parts.push(
          t('recurring.progress', {
            done: Math.min(rule.endCount, this.recurringService.recordedCount(rule)),
            n: rule.endCount,
          })
        )
      }
      if (item.state === 'paused') {
        parts.push(t('recurring.paused'))
      } else if (item.dueOn) {
        parts.push(t('recurring.dueOn', { date: shortDate(item.dueOn, locale, false) }))
      } else if (rule.nextOn && item.state === 'active') {
        parts.push(t('recurring.next', { date: shortDate(rule.nextOn, locale) }))
      }
      const transfer = rule.kind === 'transfer'
      return {
        item,
        title: ruleTitle(item, t, true),
        note: rule.note,
        schedule: parts.join(' · '),
        warning: item.stoppedBy
          ? t(
              item.stoppedBy.kind === 'wallet'
                ? 'recurring.stoppedWallet'
                : item.stoppedBy.kind === 'debt'
                  ? 'recurring.stoppedDebt'
                  : 'recurring.stoppedCategory',
              {
                name: item.stoppedBy.name,
              }
            )
          : '',
        amount: formatAmount(
          transfer ? rule.amount : item.sign * rule.amount,
          minorUnit,
          locale,
          !transfer
        ),
      }
    })
  })
  protected groups = computed(() => {
    const rows = this.rows()
    return [
      {
        key: 'active',
        heading: 'recurring.groupActive',
        rows: rows.filter((row) => row.item.state === 'active'),
      },
      {
        key: 'paused',
        heading: 'recurring.groupPaused',
        rows: rows.filter((row) => row.item.state === 'paused' || row.item.state === 'stopped'),
      },
      {
        key: 'ended',
        heading: 'recurring.groupEnded',
        rows: rows.filter((row) => row.item.state === 'ended'),
      },
    ]
  })

  constructor() {
    // "Fix" in the sync sheet opens this page with the rejected op's id.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const fix = params.get('fix')
      const op = fix ? this.syncService.rejectedOp(fix) : null
      if (fix && op) {
        const state = { mode: 'fixRule' as const, opId: fix, id: op.rowId }
        if (op.row['kind'] === 'transfer') {
          this.transferService.open(state)
        } else {
          this.transactionService.open(state)
        }
        void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      }
    })
  }

  protected add(): void {
    this.transactionService.open({ mode: 'create', repeat: true })
  }

  protected addTransfer(): void {
    this.transferService.open({ mode: 'create', repeat: true })
  }
}
