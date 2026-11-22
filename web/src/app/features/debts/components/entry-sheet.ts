import {
  ApplicationRef,
  Component,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChevronRight,
  lucideHandCoins,
  lucidePause,
  lucidePercent,
  lucidePlay,
  lucideTextAlignStart,
  lucideTrash2,
  lucideWallet,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import { DEBT_LIMITS, DebtService, toEntry } from '@/core/debt'
import type { Debt, EntrySheetState } from '@/core/debt'
import { LanguageService } from '@/core/i18n'
import { describeRepeat, describeRest, RecurringService, shortDate } from '@/core/recurring'
import { QuickAmountsService, TRANSACTION_LIMITS, TransactionService } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { walletPickItems } from '@/features/debts/debt-view'
import { DateRow } from '@/shared/components/date-row'
import {
  AmountKeypad,
  CalcAmountField,
  CalcKeypad,
  FORM_IMPORTS,
  TextareaField,
} from '@/shared/components/form'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { keepWhileClosing, SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import { WalletPick } from '@/shared/components/wallet-pick'
import { addDays, amountText, formatMoney, parseMajor } from '@/shared/utils'
import { DebtCategoryPick } from './category-pick'

type View = 'form' | 'wallet' | 'category' | 'note'
type StartState<M extends EntrySheetState['mode']> = Extract<EntrySheetState, { mode: M }>

/**
 * A debt's money that isn't income or expense (debt rule 3; mock-up frame 6): repay / receive
 * back, or borrow / lend more. Amount (keypad, and "ทั้งหมด" = what is left), wallet, note, date;
 * a repayment of a debt counted when spent may carry interest, a counted transaction (Q5). Also
 * edits an entry (delete with undo), fixes a refused one, and edits a repayment rule (debt rule
 * 13: amount, wallet, note; pause and delete in the header).
 */
@Component({
  selector: 'app-debt-entry-sheet',
  imports: [
    FORM_IMPORTS,
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmDrawerImports,
    CalcAmountField,
    CalcKeypad,
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
      lucideChevronRight,
      lucideHandCoins,
      lucidePause,
      lucidePercent,
      lucidePlay,
      lucideTextAlignStart,
      lucideTrash2,
      lucideWallet,
    }),
  ],
  templateUrl: './entry-sheet.html',
})
export class DebtEntrySheet {
  private appRef = inject(ApplicationRef)
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  protected languageService = inject(LanguageService)
  protected debtService = inject(DebtService)
  private walletService = inject(WalletService)
  private categoryService = inject(CategoryService)
  protected transactionService = inject(TransactionService)
  private recurringService = inject(RecurringService)
  private quickAmountsService = inject(QuickAmountsService)

  protected walletIcon = WALLET_DEFAULT_ICON
  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected noteMax = DEBT_LIMITS.NOTE_MAX

  // ── The sheet ──────────────────────────────────────────────────────────────

  /** What the sheet is open for, kept while it closes. Set by `DebtService.entrySheet`. */
  protected state = keepWhileClosing(this.debtService.entrySheet)
  protected open = signal(false)
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => (this.view() === 'form' ? 0 : 1))

  // ── The debt ───────────────────────────────────────────────────────────────

  /** The debt the sheet's row belongs to (also a rule's or a refused entry's). */
  private debtId = signal<string | null>(null)
  protected debt = computed<Debt | null>(() => {
    const id = this.debtId()
    return id ? this.debtService.byId(id) : null
  })
  /** The amount is in the debt's currency. */
  protected minorUnit = computed(() =>
    this.walletService.minorUnit(this.debt()?.currencyCode ?? '')
  )
  /** The repayment rule being edited (debt rule 13), if any. */
  protected rule = computed(() => {
    const state = this.state()
    return state?.mode === 'rule' ? this.recurringService.byId(state.id) : null
  })

  // ── The form ───────────────────────────────────────────────────────────────

  /** Transaction rule 3: 1 … 10¹⁵ minor units of the debt's currency. */
  private amountValid: ValidatorFn = (control) => {
    if (typeof control.value !== 'string') {
      return null
    }
    const result = parseMajor(control.value, this.minorUnit())
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
  /** Validators run while the form is built: `needsWallet` (made after it) reads the kind here. */
  private walletValid: ValidatorFn = (control) => {
    const kind: unknown = control.parent?.get('kind')?.value
    const noWallet = this.debt()?.countAs === 'repaid' && kind === 'principal'
    return noWallet || control.value ? null : { required: true }
  }

  form = this.nnfb.group({
    kind: this.nnfb.control<'principal' | 'repayment'>('repayment'),
    amount: ['', [this.amountValid]],
    walletId: ['', [this.walletValid]],
    note: ['', [Validators.maxLength(DEBT_LIMITS.NOTE_MAX)]],
    occurredOn: [''],
  })

  /** The amount row's keypad: opens by itself when adding. */
  protected keypad = new AmountKeypad(this.form.controls.amount, () => this.minorUnit())

  protected values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() })
  /** "principal" (borrow / lend more) or "repayment" (pay / get back). */
  private kind = computed(() => this.values().kind ?? 'repayment')
  protected note = computed(() => (this.values().note ?? '').trim())
  protected lastDay = computed(() => addDays(this.transactionService.today(), 365))
  /** Quick amounts are Thai banknotes: THB wallets only (currency.md → Web screens). */
  protected quickAmounts = computed(() =>
    this.quickAmountsService.forCurrency(this.debt()?.currencyCode ?? '')
  )

  // ── Wallet ─────────────────────────────────────────────────────────────────

  /** A `repaid` debt borrows more without a wallet (nothing comes in, debt rule 3). */
  protected needsWallet = computed(
    () => !(this.debt()?.countAs === 'repaid' && this.kind() === 'principal')
  )
  protected wallet = computed<Wallet | null>(() => {
    const id = this.values().walletId ?? ''
    return id ? this.walletService.byId(id) : null
  })
  /** The book's open wallets in the debt's currency. */
  protected walletChoices = computed(() => {
    const debt = this.debt()
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
      (key) => this.t(key)
    )
  )
  protected walletLabel = computed(() => {
    this.languageService.language()
    return this.t(`debts.walletOf.${this.debt()?.direction ?? 'borrowed'}.${this.kind()}`)
  })

  // ── Interest (Q5): a counted transaction beside a repayment ────────────────

  protected interestAmount = this.nnfb.control('')
  private interestValues = toSignal(this.interestAmount.valueChanges, { initialValue: '' })
  protected interestValue = computed(() => {
    const parsed = parseMajor(this.interestValues() || '0', this.minorUnit())
    return parsed.ok ? parsed.minor : 0
  })
  protected interestCategoryId = signal<string | null>(null)
  protected interestCategory = computed(() => {
    const id = this.interestCategoryId()
    return id ? this.categoryService.byId(id) : null
  })
  /** Interest typed but no category for it: the row shows its error. */
  protected interestMissing = signal(false)
  /** Only a new repayment of a debt counted when spent carries interest. */
  protected interestAllowed = computed(() => {
    const state = this.state()
    return (
      state?.mode === 'create' && this.kind() === 'repayment' && this.debt()?.countAs === 'spent'
    )
  })

  // ── Lines: the title, what is left, the hint ───────────────────────────────

  protected heading = computed(() => {
    this.languageService.language()
    const state = this.state()
    const debt = this.debt()
    if (state?.mode === 'rule') {
      return this.t('recurring.editHeading')
    }
    if (state?.mode === 'edit' || state?.mode === 'fix') {
      return this.t(state.mode === 'fix' ? 'debts.fixEntry' : 'debts.editEntry')
    }
    return this.t(`debts.sheet.${debt?.direction ?? 'borrowed'}.${this.kind()}`)
  })
  private left = computed(() => {
    const debt = this.debt()
    return debt ? (this.debtService.item(debt.id)?.left ?? 0) : 0
  })
  protected leftText = computed(() => {
    const debt = this.debt()
    const left = this.left()
    return debt && left > 0
      ? formatMoney(left, debt.currencyCode, this.minorUnit(), this.languageService.locale())
      : null
  })
  /** "ทั้งหมด x": pay (or get) back what is left (mock-up frame 6). */
  protected allText = computed(() =>
    this.state()?.mode === 'create' && this.kind() === 'repayment' ? this.leftText() : null
  )
  /** A rule's schedule and next date, or "not counted" for a new entry. */
  protected hint = computed(() => {
    this.languageService.language()
    const rule = this.rule()
    const locale = this.languageService.locale()
    if (rule) {
      return [
        describeRepeat(rule, rule.startOn, this.t, locale),
        describeRest(rule, this.t, locale),
        rule.nextOn
          ? this.t('recurring.nextLine', { date: shortDate(rule.nextOn, locale) })
          : this.t('recurring.ended'),
      ].join(' · ')
    }
    return this.state()?.mode === 'create' ? this.t('debts.notCounted') : null
  })

  constructor() {
    effect(() => {
      const state = this.debtService.entrySheet()
      untracked(() => {
        if (state) {
          this.start(state)
        }
        this.open.set(state !== null)
      })
    })
  }

  // ── Template actions ───────────────────────────────────────────────────────

  /** Another row: the keypad closes. */
  /**
   * The note row. The view renders at once, inside the tap, so its text field takes the focus
   * in the same tap: iOS Safari brings the keyboard up only for a focus made there.
   */
  protected openNote(): void {
    this.pick('note')
    this.appRef.tick()
  }

  protected pick(view: 'wallet' | 'category' | 'note'): void {
    this.keypad.close()
    this.view.set(view)
  }

  protected chooseWallet(id: string): void {
    this.form.controls.walletId.setValue(id)
    this.form.controls.walletId.markAsDirty()
    this.view.set('form')
  }

  protected balanceText(wallet: Wallet): string {
    return formatMoney(
      this.walletService.balance(wallet),
      wallet.currencyCode,
      this.walletService.minorUnit(wallet.currencyCode),
      this.languageService.locale()
    )
  }

  /** "ทั้งหมด": the amount becomes what is left. */
  protected setAll(): void {
    const left = this.left()
    if (left > 0) {
      this.form.controls.amount.setValue(amountText(left, this.minorUnit()))
      this.form.controls.amount.markAsDirty()
      this.keypad.close()
    }
  }

  /** Recurring rule 5: pause or resume the repayment rule, at once. */
  protected togglePause(): void {
    const rule = this.rule()
    if (!rule) {
      return
    }
    this.recurringService.setPaused(rule.id, !rule.isPaused)
    toast.success(this.t(rule.isPaused ? 'recurring.resumed' : 'recurring.paused2'))
  }

  protected save(): void {
    const state = this.state()
    const debt = this.debt()
    this.form.controls.walletId.updateValueAndValidity({ emitEvent: false })
    const interest = this.interestAllowed() ? this.interestValue() : 0
    this.interestMissing.set(interest > 0 && !this.interestCategoryId())
    if (!state || !debt || this.form.invalid || this.interestMissing()) {
      this.form.markAllAsTouched()
      return
    }
    if (!this.debtService.canWrite()) {
      return
    }
    const value = this.form.getRawValue()
    const amount = parseMajor(value.amount, this.minorUnit())
    const minor = amount.ok ? amount.minor : 0
    if (state.mode === 'rule') {
      const rule = this.rule()
      if (rule) {
        this.recurringService.update(rule.id, {
          ...rule,
          walletId: value.walletId,
          amount: minor,
          note: value.note,
        })
        toast.success(this.t('recurring.saved'))
      }
      this.finish()
      return
    }
    const entryId =
      state.mode === 'edit' ? state.id : state.mode === 'fix' ? this.refusedId(state.opId) : null
    this.debtService.saveEntry(
      entryId,
      debt.id,
      {
        kind: value.kind,
        amount: minor,
        walletId: this.needsWallet() ? value.walletId : null,
        occurredOn: value.occurredOn,
        note: value.note,
      },
      interest > 0 && this.interestCategoryId()
        ? { amount: interest, categoryId: this.interestCategoryId() ?? '' }
        : null,
      state.mode === 'fix' ? state.opId : null
    )
    toast.success(this.t(state.mode === 'create' ? 'debts.entrySaved' : 'debts.saved'))
    this.finish()
  }

  /** An entry (or the repayment rule) goes at once, "เลิกทำ" in the toast. */
  protected remove(): void {
    const state = this.state()
    if (state?.mode === 'rule') {
      this.recurringService.remove(state.id)
      toast(this.t('recurring.deleted'), {
        action: {
          label: this.t('transactions.undo'),
          onClick: () => this.recurringService.restore(state.id),
        },
      })
      this.finish()
      return
    }
    if (state?.mode !== 'edit') {
      return
    }
    this.debtService.removeEntry(state.id)
    toast(this.t('debts.entryDeleted'), {
      action: {
        label: this.t('transactions.undo'),
        onClick: () => this.debtService.restoreEntry(state.id),
      },
    })
    this.finish()
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.debtService.entrySheet.set(null)
  }

  // ── Opening the sheet: the form starts from the state ──────────────────────

  private start(state: EntrySheetState): void {
    this.view.set('form')
    this.interestAmount.reset('')
    this.interestMissing.set(false)
    switch (state.mode) {
      case 'rule':
        this.startRule(state)
        return
      case 'create':
        this.startCreate(state)
        return
      case 'edit':
      case 'fix':
        this.startEdit(state)
        return
    }
  }

  /** A repayment rule (debt rule 13): its amount, wallet and note. */
  private startRule(state: StartState<'rule'>): void {
    const rule = this.recurringService.byId(state.id)
    const debt = rule?.debtId ? this.debtService.byId(rule.debtId) : null
    if (!rule || !debt) {
      this.debtService.entrySheet.set(null)
      return
    }
    this.debtId.set(debt.id)
    this.form.reset({
      kind: 'repayment',
      amount: amountText(rule.amount, this.walletService.minorUnit(debt.currencyCode)),
      walletId: rule.walletId,
      note: rule.note,
      occurredOn: rule.startOn,
    })
    this.keypad.open.set(false)
  }

  /** A new entry: from the wallet the debt last used (else the first of its currency), today. */
  private startCreate(state: StartState<'create'>): void {
    const debt = this.debtService.byId(state.debtId)
    if (!debt) {
      this.debtService.entrySheet.set(null)
      return
    }
    this.debtId.set(debt.id)
    this.interestCategoryId.set(this.debtService.interestCategory(debt.id))
    const last = this.debtService
      .history(debt.id)
      .find((item) => item.kind === 'entry' && item.entry.walletId !== null)
    const lastWallet = last?.kind === 'entry' ? last.entry.walletId : null
    const usable = this.walletChoices()
    const walletId = usable.find((wallet) => wallet.id === lastWallet)?.id ?? usable.at(0)?.id ?? ''
    this.form.reset({
      kind: state.kind,
      amount: '',
      walletId,
      note: '',
      occurredOn: this.transactionService.today(),
    })
    this.keypad.open.set(true)
  }

  /** An entry from the history, or "fix" a refused one (its refused values, errors showing). */
  private startEdit(state: StartState<'edit' | 'fix'>): void {
    const refused =
      state.mode === 'fix' ? this.debtService.refused(state.opId, 'debt_entries') : null
    const entry =
      state.mode === 'edit'
        ? this.debtService.entryById(state.id)
        : refused
          ? toEntry(refused)
          : null
    const debt = entry ? this.debtService.byId(entry.debtId) : null
    if (!entry || !debt) {
      this.debtService.entrySheet.set(null)
      return
    }
    this.debtId.set(debt.id)
    this.form.reset({
      kind: entry.kind,
      amount: amountText(entry.amount, this.walletService.minorUnit(debt.currencyCode)),
      walletId: entry.walletId ?? '',
      note: entry.note,
      occurredOn: entry.occurredOn,
    })
    this.keypad.open.set(false)
    if (refused) {
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** The id of the entry a refused op wrote. */
  private refusedId(opId: string): string | null {
    const row = this.debtService.refused(opId, 'debt_entries')
    return row ? String(row['id']) : null
  }

  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)
}
