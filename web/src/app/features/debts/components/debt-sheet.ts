import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { AbstractControl, ValidatorFn } from '@angular/forms'
import { Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideClock,
  lucideMinus,
  lucidePlus,
  lucideRepeat,
  lucideTextAlignStart,
  lucideTrash2,
  lucideUser,
  lucideWallet,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import { DEBT_LIMITS, DEBTS_ROUTE, DebtService, toDebt } from '@/core/debt'
import type { DebtCountAs, DebtDirection, PlanValues } from '@/core/debt'
import { LanguageService } from '@/core/i18n'
import { describeRepeat, shortDate } from '@/core/recurring'
import { NavHistory } from '@/core/routing'
import { QuickAmountsService, TRANSACTION_LIMITS, TransactionService } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { walletPickItems } from '@/features/debts/debt-view'
import { DateRow } from '@/shared/components/date-row'
import {
  CalcAmountField,
  CalcKeypad,
  FORM_IMPORTS,
  SegmentedField,
  TextareaField,
} from '@/shared/components/form'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import { WalletPick } from '@/shared/components/wallet-pick'
import {
  addDays,
  addMonths,
  addQuickAmount,
  CALC_KEYBOARD,
  evaluate,
  formatMoney,
  parseMajor,
  pressKey,
  toMajorText,
} from '@/shared/utils'
import type { CalcKey } from '@/shared/utils'
import { DebtCategoryPick } from './category-pick'

/** Whether the form a control sits in describes a `repaid` debt (the validators run before the
 * form is assigned, so they read the control's parent). */
const repaidIn = (control: AbstractControl): boolean => {
  const parent = control.parent
  return parent?.get('direction')?.value === 'borrowed' && parent.get('countAs')?.value === 'repaid'
}

type View = 'form' | 'wallet' | 'category' | 'note' | 'plan' | 'planWallet' | 'confirmDelete'

/**
 * The debt form (docs/features/debt.md → Web screens, mock-up frames 3–4): ยืมมา | ให้ยืม, then
 * one card of rows: person, amount (keypad), the wallet the money came into or left (a `repaid`
 * debt: the instalments' category), note, date; "นับเป็นรายจ่าย" (borrowed only); "ผ่อนเป็นงวด"
 * (a recurring rule, debt rule 13); under "เพิ่มเติม" the due date. Editing changes only person,
 * note, due date and the instalments' category; delete in the header asks first (debt rule 5).
 */
@Component({
  selector: 'app-debt-sheet',
  imports: [
    FORM_IMPORTS,
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmDrawerImports,
    CalcAmountField,
    CalcKeypad,
    SegmentedField,
    TextareaField,
    IconBadge,
    SheetFrame,
    Slide,
    DebtCategoryPick,
    DateRow,
    WalletPick,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideClock,
      lucideMinus,
      lucidePlus,
      lucideRepeat,
      lucideTextAlignStart,
      lucideTrash2,
      lucideUser,
      lucideWallet,
    }),
  ],
  templateUrl: './debt-sheet.html',
})
export class DebtSheet {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private router = inject(Router)
  private navHistory = inject(NavHistory)
  protected languageService = inject(LanguageService)
  protected debtService = inject(DebtService)
  private walletService = inject(WalletService)
  private categoryService = inject(CategoryService)
  private bookService = inject(BookService)
  protected transactionService = inject(TransactionService)
  private quickAmountsService = inject(QuickAmountsService)

  protected walletIcon = WALLET_DEFAULT_ICON
  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected noteMax = DEBT_LIMITS.NOTE_MAX
  protected personMax = DEBT_LIMITS.PERSON_MAX
  protected readonly countOptions: readonly DebtCountAs[] = ['spent', 'repaid']
  protected state = this.debtService.sheet
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => {
    const view = this.view()
    return view === 'form' ? 0 : view === 'planWallet' ? 2 : 1
  })
  protected keypad = signal(false)
  protected more = signal(false)
  protected open = signal(false)
  /** Quick amounts are Thai banknotes: THB wallets only (currency.md → Web screens). */
  protected quickAmounts = computed(() => this.quickAmountsService.forCurrency(this.currencyCode()))

  /** Rule 6 (transaction rule 3): 1 … 10¹⁵ minor units. */
  private amountValid: ValidatorFn = (control) => {
    if (typeof control.value !== 'string' || this.state()?.mode === 'edit') {
      return null
    }
    // The fields below aren't made yet while the form is built: the wallet from the control's form.
    const walletId: unknown = control.parent?.get('walletId')?.value
    const wallet =
      typeof walletId === 'string' && walletId ? this.walletService.byId(walletId) : null
    const result = evaluate(
      control.value,
      this.walletService.minorUnit(wallet?.currencyCode ?? this.walletService.defaultCurrency())
    )
    if (!result.ok) {
      return { amountFormat: 'transactions.amountFormat' }
    }
    if (result.minor <= 0) {
      return { amountRequired: 'transactions.amountRequired' }
    }
    return result.minor > TRANSACTION_LIMITS.AMOUNT_MAX
      ? { amountTooBig: 'transactions.amountTooBig' }
      : null
  }
  /** The wallet is needed unless a `repaid` debt (or an edit). */
  private walletValid: ValidatorFn = (control) =>
    this.state()?.mode === 'edit' || repaidIn(control) || control.value ? null : { required: true }
  private categoryValid: ValidatorFn = (control) =>
    repaidIn(control) && !control.value ? { required: true } : null

  form = this.nnfb.group({
    direction: this.nnfb.control<DebtDirection>('borrowed'),
    person: ['', [Validators.required, Validators.maxLength(DEBT_LIMITS.PERSON_MAX)]],
    amount: ['', [this.amountValid]],
    walletId: ['', [this.walletValid]],
    categoryId: ['', [this.categoryValid]],
    note: ['', [Validators.maxLength(DEBT_LIMITS.NOTE_MAX)]],
    occurredOn: [''],
    countAs: this.nnfb.control<DebtCountAs>('spent'),
    dueOn: [''],
  })
  // Instalments (debt rule 13): monthly from the first one, n of them.
  protected planAmount = this.nnfb.control('')
  protected planStart = this.nnfb.control('')
  protected planCount = signal(0)
  protected planConfirm = signal(false)
  protected planWalletId = signal<string | null>(null)
  private planStartValues = toSignal(this.planStart.valueChanges, { initialValue: '' })
  protected planStartValue = computed(
    () => this.planStartValues() || this.transactionService.today()
  )

  protected values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() })
  protected direction = computed(() => this.values().direction ?? 'borrowed')
  protected repaid = computed(() => {
    const state = this.state()
    if (state?.mode === 'edit') {
      return this.debtService.byId(state.id)?.countAs === 'repaid'
    }
    return this.direction() === 'borrowed' && this.values().countAs === 'repaid'
  })
  protected note = computed(() => (this.values().note ?? '').trim())
  protected editing = computed(() => this.state()?.mode === 'edit')
  protected heading = computed(() => {
    const state = this.state()
    return state?.mode === 'edit'
      ? 'debts.editHeading'
      : state?.mode === 'fix'
        ? 'debts.fixHeading'
        : `debts.createHeading.${this.direction()}`
  })
  protected bookId = computed(() => this.bookService.current()?.id ?? '')
  protected walletChoices = computed(() => this.walletService.openOf(this.bookId()))
  protected walletItems = computed(() =>
    walletPickItems(
      this.walletChoices(),
      this.walletService,
      this.languageService.locale(),
      (key) => this.transloco.translate(key)
    )
  )
  protected wallet = computed<Wallet | null>(() => {
    const id = this.values().walletId ?? ''
    return id ? this.walletService.byId(id) : null
  })
  protected planWallet = computed<Wallet | null>(() => {
    const id = this.planWalletId()
    return id ? this.walletService.byId(id) : null
  })
  protected category = computed(() => {
    const id = this.values().categoryId ?? ''
    return id ? this.categoryService.byId(id) : null
  })
  protected currencyCode = computed(
    () => this.wallet()?.currencyCode ?? this.walletService.defaultCurrency()
  )
  protected minorUnit = computed(() => this.walletService.minorUnit(this.currencyCode()))
  protected lastDay = computed(() => addDays(this.transactionService.today(), 365))
  protected directionOptions = computed(() => {
    this.languageService.language()
    return (['borrowed', 'lent'] as const).map((value) => ({
      value,
      label: this.transloco.translate(`debts.${value}`),
    }))
  })
  protected planText = computed(() => {
    this.languageService.language()
    const count = this.planCount()
    if (count <= 0) {
      return null
    }
    const locale = this.languageService.locale()
    const amount = parseMajor(this.planAmount.value || '0', this.minorUnit())
    const money = formatMoney(
      amount.ok ? amount.minor : 0,
      this.currencyCode(),
      this.minorUnit(),
      locale
    )
    return {
      title: this.transloco.translate('debts.planTitle', { count, amount: money }),
      sub: [
        describeRepeat({ frequency: 'month', interval: 1 }, this.planStartValue(), this.t, locale),
        this.planWallet()?.name ?? '',
        this.transloco.translate(this.planConfirm() ? 'recurring.ask' : 'recurring.auto'),
      ]
        .filter((part) => part)
        .join(' · '),
    }
  })
  protected planHint = computed(() => {
    this.languageService.language()
    const count = this.planCount()
    if (count <= 0) {
      return null
    }
    const locale = this.languageService.locale()
    const first = this.planStartValue()
    const last = addMonths(first, count - 1)
    return this.transloco.translate('debts.planLine', {
      first: shortDate(first, locale),
      last: shortDate(last, locale),
    })
  })
  protected deleteText = computed(() => {
    this.languageService.language()
    const state = this.state()
    const id = state?.mode === 'edit' ? state.id : null
    const history = id ? this.debtService.history(id) : []
    const entries = history.filter((item) => item.kind === 'entry').length
    return this.transloco.translate('debts.deleteText', { count: entries })
  })
  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)

  constructor() {
    this.form.controls.direction.valueChanges.pipe(takeUntilDestroyed()).subscribe((direction) => {
      if (direction === 'lent') {
        this.form.controls.countAs.setValue('spent')
      }
      this.revalidate()
    })
    this.form.controls.countAs.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.revalidate())
    effect(() => {
      const state = this.state()
      untracked(() => {
        if (state) {
          this.start()
        }
        this.open.set(state !== null)
      })
    })
  }

  protected balanceText(wallet: Wallet): string {
    return formatMoney(
      this.walletService.balance(wallet),
      wallet.currencyCode,
      this.walletService.minorUnit(wallet.currencyCode),
      this.languageService.locale()
    )
  }

  protected setCountAs(value: DebtCountAs): void {
    this.form.controls.countAs.setValue(value)
    this.form.markAsDirty()
  }

  protected defaultDue(): string {
    return addMonths(this.transactionService.today(), 1)
  }

  protected setDue(day: string | null): void {
    this.form.controls.dueOn.setValue(day ?? '')
    this.form.markAsDirty()
  }

  protected stepCount(step: number): void {
    const count = Math.min(999, Math.max(0, this.planCount() + step))
    this.planCount.set(count)
    // The instalment starts as the total split evenly, while the user hasn't typed one.
    const total = evaluate(this.form.controls.amount.value, this.minorUnit())
    if (
      count > 0 &&
      total.ok &&
      total.minor > 0 &&
      (!this.planAmount.dirty || !this.planAmount.value)
    ) {
      this.planAmount.setValue(
        toMajorText(Math.ceil(total.minor / count), this.minorUnit()).replace(/,/g, '')
      )
    }
    this.form.markAsDirty()
  }

  protected leaveAmount(event: Event): void {
    const target = event.target
    if (
      !this.keypad() ||
      !(target instanceof Element) ||
      target.closest('app-calc-amount-field') ||
      !target.closest('button, input, label, textarea, select')
    ) {
      return
    }
    this.settleAmount()
    this.keypad.set(false)
  }

  protected pick(view: 'wallet' | 'category' | 'note' | 'plan'): void {
    this.settleAmount()
    this.keypad.set(false)
    if (view === 'plan' && !this.planWalletId()) {
      this.planWalletId.set(
        this.form.controls.walletId.value || this.walletChoices().at(0)?.id || null
      )
    }
    this.view.set(view)
  }

  protected chooseWallet(id: string): void {
    this.form.controls.walletId.setValue(id)
    this.form.controls.walletId.markAsDirty()
    this.view.set('form')
  }

  protected chooseCategory(id: string): void {
    this.form.controls.categoryId.setValue(id)
    this.form.controls.categoryId.markAsDirty()
    this.view.set('form')
  }

  protected press(key: CalcKey | '='): void {
    const control = this.form.controls.amount
    if (key === '=') {
      this.settleAmount()
      this.keypad.set(false)
      return
    }
    control.setValue(pressKey(control.value, key, this.minorUnit()))
    control.markAsDirty()
  }

  protected addQuick(major: number): void {
    const control = this.form.controls.amount
    control.setValue(addQuickAmount(control.value, major, this.minorUnit()))
    control.markAsDirty()
  }

  protected onKey(event: KeyboardEvent): void {
    if (!this.keypad() || this.view() !== 'form' || event.target instanceof HTMLInputElement) {
      return
    }
    const key = /^\d$/.test(event.key) ? (event.key as CalcKey) : CALC_KEYBOARD[event.key]
    if (key) {
      event.preventDefault()
      event.stopPropagation()
      this.press(key)
    }
  }

  protected save(): void {
    const state = this.state()
    this.settleAmount()
    this.revalidate()
    if (!state || this.form.invalid || !this.debtService.canWrite()) {
      this.form.markAllAsTouched()
      return
    }
    const value = this.form.getRawValue()
    const edit = {
      person: value.person,
      note: value.note,
      dueOn: value.dueOn || null,
      categoryId: value.categoryId || null,
    }
    if (state.mode === 'edit') {
      this.debtService.update(state.id, edit)
      toast.success(this.t('debts.saved'))
      this.finish()
      return
    }
    if (state.mode === 'fix') {
      this.debtService.fix(state.opId, edit)
      toast.success(this.t('debts.saved'))
      this.finish()
      return
    }
    const amount = evaluate(value.amount, this.minorUnit())
    const repaid = value.direction === 'borrowed' && value.countAs === 'repaid'
    const planAmount = parseMajor(this.planAmount.value || '0', this.minorUnit())
    const planWallet = this.planWalletId()
    const plan: PlanValues | null =
      this.planCount() > 0 && planAmount.ok && planAmount.minor > 0 && planWallet
        ? {
            repeat: {
              frequency: 'month',
              interval: 1,
              endOn: null,
              endCount: this.planCount(),
              confirm: this.planConfirm(),
            },
            startOn: this.planStartValue(),
            amount: planAmount.minor,
            walletId: planWallet,
          }
        : null
    const id = this.debtService.create(
      {
        ...edit,
        direction: value.direction,
        countAs: repaid ? 'repaid' : 'spent',
        amount: amount.ok ? amount.minor : 0,
        walletId: repaid ? null : value.walletId,
        occurredOn: value.occurredOn,
        currencyCode: this.currencyCode(),
      },
      plan
    )
    toast.success(this.t(`debts.created.${value.direction}`))
    this.finish()
    void this.router.navigate([DEBTS_ROUTE, id])
  }

  protected remove(): void {
    const state = this.state()
    if (state?.mode !== 'edit') {
      return
    }
    this.debtService.remove(state.id)
    toast(this.t('debts.deleted'))
    this.finish()
    // Off the deleted debt's page, back where it was opened from (NavHistory).
    if (this.router.url.startsWith(`${DEBTS_ROUTE}/`)) {
      this.navHistory.back()
    }
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.state.set(null)
  }

  private revalidate(): void {
    this.form.controls.walletId.updateValueAndValidity({ emitEvent: false })
    this.form.controls.categoryId.updateValueAndValidity({ emitEvent: false })
    this.form.controls.amount.updateValueAndValidity({ emitEvent: false })
  }

  private settleAmount(): void {
    const control = this.form.controls.amount
    const result = evaluate(control.value, this.minorUnit())
    if (result.ok && result.minor > 0 && /[+\-×÷]/.test(control.value)) {
      control.setValue(toMajorText(result.minor, this.minorUnit()).replace(/,/g, ''))
    }
  }

  private start(): void {
    const state = this.state()
    this.view.set('form')
    this.planCount.set(0)
    this.planConfirm.set(false)
    this.planWalletId.set(null)
    this.planAmount.reset('')
    this.planStart.reset(addMonths(this.transactionService.today(), 1))
    if (!state) {
      return
    }
    if (state.mode === 'create') {
      const walletId =
        this.transactionService.viewWallet()?.id ?? this.transactionService.defaultWalletId() ?? ''
      this.form.reset({
        direction: state.direction,
        person: '',
        amount: '',
        walletId,
        categoryId: '',
        note: '',
        occurredOn: this.transactionService.today(),
        countAs: 'spent',
        dueOn: '',
      })
      this.more.set(false)
      this.keypad.set(false)
      return
    }
    const refused = state.mode === 'fix' ? this.debtService.refused(state.opId, 'debts') : null
    const debt =
      state.mode === 'edit' ? this.debtService.byId(state.id) : refused ? toDebt(refused) : null
    if (!debt) {
      this.state.set(null)
      return
    }
    this.form.reset({
      direction: debt.direction,
      person: debt.person,
      amount: '',
      walletId: '',
      categoryId: debt.categoryId ?? '',
      note: debt.note,
      occurredOn: this.transactionService.today(),
      countAs: debt.countAs,
      dueOn: debt.dueOn ?? '',
    })
    this.more.set(debt.dueOn !== null)
    this.keypad.set(false)
    if (refused) {
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    }
  }
}
