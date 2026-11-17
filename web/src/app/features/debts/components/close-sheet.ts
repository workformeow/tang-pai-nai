import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronRight, lucideWallet } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import { DebtService } from '@/core/debt'
import { LanguageService } from '@/core/i18n'
import { TransactionService } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { walletPickItems } from '@/features/debts/debt-view'
import { DateRow } from '@/shared/components/date-row'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import { WalletPick } from '@/shared/components/wallet-pick'
import { addDays, formatMoney } from '@/shared/utils'
import { DebtCategoryPick } from './category-pick'

type View = 'form' | 'wallet' | 'category'

/**
 * "ปิดหนี้" with something left (debt rule 4, mock-up frame 9): pay (or get) back the rest into a
 * wallet, or forgive it: counted once now (an expense of a lent debt, an income of a borrowed one
 * counted when spent) in a category; a `repaid` debt's rest goes uncounted.
 */
@Component({
  selector: 'app-debt-close-sheet',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmDrawerImports,
    IconBadge,
    SheetFrame,
    Slide,
    DebtCategoryPick,
    DateRow,
    WalletPick,
  ],
  providers: [provideIcons({ lucideChevronRight, lucideWallet })],
  templateUrl: './close-sheet.html',
})
export class DebtCloseSheet {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  protected languageService = inject(LanguageService)
  protected debtService = inject(DebtService)
  private walletService = inject(WalletService)
  private categoryService = inject(CategoryService)
  protected transactionService = inject(TransactionService)

  protected walletIcon = WALLET_DEFAULT_ICON
  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected readonly options = ['rest', 'forgive'] as const
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => (this.view() === 'form' ? 0 : 1))
  protected how = signal<'rest' | 'forgive'>('rest')
  protected walletId = signal<string | null>(null)
  protected categoryId = signal<string | null>(null)
  protected missing = signal(false)
  protected day = this.nnfb.control('')
  private dayValues = toSignal(this.day.valueChanges, { initialValue: '' })
  protected dayValue = computed(() => this.dayValues() || this.transactionService.today())
  protected lastDay = computed(() => addDays(this.transactionService.today(), 365))

  protected open = computed(() => this.debtService.closeSheet() !== null)
  protected item = computed(() => {
    const id = this.debtService.closeSheet()
    return id ? this.debtService.item(id) : null
  })
  /** A forgiven rest counts once now, except a `repaid` debt's (never counted, debt rule 4). */
  protected counts = computed(() => this.item()?.debt.countAs === 'spent')
  protected wallet = computed(() => {
    const id = this.walletId()
    return id ? this.walletService.byId(id) : null
  })
  protected category = computed(() => {
    const id = this.categoryId()
    return id ? this.categoryService.byId(id) : null
  })
  protected walletChoices = computed(() => {
    const debt = this.item()?.debt
    return debt
      ? this.walletService
          .openOf(debt.bookId)
          .filter((wallet) => wallet.currencyCode === debt.currencyCode)
      : []
  })
  protected walletItems = computed(() =>
    walletPickItems(
      this.walletChoices(),
      this.walletService,
      this.languageService.locale(),
      (key) => this.transloco.translate(key)
    )
  )
  protected leftText = computed(() => {
    const item = this.item()
    return item
      ? formatMoney(
          item.left,
          item.debt.currencyCode,
          item.minorUnit,
          this.languageService.locale()
        )
      : ''
  })

  constructor() {
    effect(() => {
      const id = this.debtService.closeSheet()
      untracked(() => {
        if (!id) {
          return
        }
        this.view.set('form')
        this.how.set('rest')
        this.missing.set(false)
        this.categoryId.set(null)
        // The wallet the debt used last, else the first open one of its currency.
        const last = this.debtService
          .history(id)
          .find((row) => row.kind === 'entry' && row.entry.walletId !== null)
        const lastId = last?.kind === 'entry' ? last.entry.walletId : null
        const choices = this.walletChoices()
        this.walletId.set(
          choices.find((wallet) => wallet.id === lastId)?.id ?? choices.at(0)?.id ?? null
        )
        this.day.reset(this.transactionService.today())
      })
    })
  }

  protected hintOf(option: 'rest' | 'forgive'): string {
    this.languageService.language()
    const item = this.item()
    if (!item) {
      return ''
    }
    const amount = this.leftText()
    if (option === 'rest') {
      return this.transloco.translate(`debts.closeHint.rest.${item.debt.direction}`, { amount })
    }
    return this.transloco.translate(
      item.debt.countAs === 'repaid'
        ? 'debts.closeHint.forgiveRepaid'
        : `debts.closeHint.forgive.${item.debt.direction}`,
      { amount }
    )
  }

  protected confirm(): void {
    const item = this.item()
    if (!item || !this.debtService.canWrite()) {
      return
    }
    const how = this.how()
    const walletId = this.walletId()
    const categoryId = this.categoryId()
    if ((how === 'rest' && !walletId) || (how === 'forgive' && this.counts() && !categoryId)) {
      this.missing.set(true)
      return
    }
    this.debtService.close(
      item.debt.id,
      how === 'rest' ? { kind: 'rest', walletId: walletId ?? '' } : { kind: 'forgive', categoryId },
      this.dayValue()
    )
    toast.success(this.transloco.translate('debts.closed'))
    this.debtService.closeSheet.set(null)
  }
}
