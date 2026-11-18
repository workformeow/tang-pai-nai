import { Component, computed, inject, model } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideArrowLeftRight, lucideCheck, lucideHandCoins } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { RecurringService, ruleTitle, shortDate } from '@/core/recurring'
import type { Occurrence } from '@/core/recurring'
import { TransactionService, TransferService } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { formatAmount, fromDay } from '@/shared/utils'

/**
 * "ถึงกำหนด" (docs/features/recurring.md rule 10, mock-up frame 10): the due occurrences of
 * ask-first rules, oldest first, each with "บันทึก" (as the rule says, on its day) and "ข้าม";
 * a tap on one opens the form filled from its rule, so this month's bill can be typed first.
 */
@Component({
  selector: 'app-due-sheet',
  imports: [TranslocoPipe, NgIcon, HlmButton, HlmDrawerImports, IconBadge, SheetFrame],
  providers: [provideIcons({ lucideArrowLeftRight, lucideCheck, lucideHandCoins })],
  templateUrl: './due-sheet.html',
})
export class DueSheet {
  protected recurringService = inject(RecurringService)
  private transactionService = inject(TransactionService)
  private transferService = inject(TransferService)
  private walletService = inject(WalletService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)

  open = model(false)
  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON

  protected rows = computed(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const day = new Intl.DateTimeFormat(locale, { weekday: 'short' })
    return this.recurringService.due().map((occurrence) => {
      const { item } = occurrence
      const minorUnit = this.walletService.minorUnit(item.currencyCode)
      return {
        occurrence,
        title: ruleTitle(item, (key, params) => this.transloco.translate(key, params), true),
        sub: [
          `${day.format(fromDay(occurrence.on))} ${shortDate(occurrence.on, locale)}`,
          item.walletName,
          item.rule.note,
        ]
          .filter((part) => part)
          .join(' · '),
        amount: formatAmount(item.sign * item.rule.amount, minorUnit, locale, true),
      }
    })
  })

  protected confirm(occurrence: Occurrence): void {
    this.recurringService.confirm(occurrence.item.rule.id, occurrence.on)
    toast.success(this.transloco.translate('recurring.confirmed'))
    this.closeWhenDone()
  }

  protected skip(occurrence: Occurrence): void {
    this.recurringService.skip(occurrence.item.rule.id, occurrence.on)
    toast(this.transloco.translate('recurring.skipped'))
    this.closeWhenDone()
  }

  protected confirmAll(): void {
    const count = this.recurringService.confirmAll()
    toast.success(this.transloco.translate('recurring.allConfirmed', { count }))
    this.open.set(false)
  }

  /** The form, filled from the rule; saving it records this occurrence (rule 10). */
  protected edit(occurrence: Occurrence): void {
    const { rule } = occurrence.item
    const target = { ruleId: rule.id, on: occurrence.on }
    this.open.set(false)
    if (rule.kind === 'debt') {
      // A debt's repayment is recorded as the rule says, from its debt's page (debt rule 13).
      this.recurringService.open(rule.id)
      return
    }
    if (rule.kind === 'transfer') {
      this.transferService.open({
        mode: 'create',
        occurrence: target,
        values: {
          fromWalletId: rule.walletId,
          toWalletId: rule.toWalletId ?? '',
          amount: rule.amount,
          occurredOn: occurrence.on,
          note: rule.note,
        },
      })
      return
    }
    this.transactionService.open({
      mode: 'create',
      occurrence: target,
      type: occurrence.item.sign > 0 ? 'income' : 'expense',
      values: {
        walletId: rule.walletId,
        categoryId: rule.categoryId ?? '',
        amount: rule.amount,
        occurredOn: occurrence.on,
        note: rule.note,
        excludeFromReport: rule.excludeFromReport,
      },
    })
  }

  private closeWhenDone(): void {
    if (this.recurringService.due().length === 0) {
      this.open.set(false)
    }
  }
}
