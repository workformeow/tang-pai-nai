import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArrowUpDown,
  lucideCheck,
  lucideChevronRight,
  lucideCopy,
  lucideListPlus,
  lucidePause,
  lucidePlay,
  lucideTextAlignStart,
  lucideTrash2,
  lucideWallet,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { SyncService } from '@/core/offline'
import {
  describeRepeat,
  describeRest,
  MONTHLY,
  nextOnOrAfter,
  RecurringService,
  shortDate,
  toRule as toRuleRow,
} from '@/core/recurring'
import type { RepeatValues, RuleValues } from '@/core/recurring'
import {
  QuickAmountsService,
  TRANSACTION_LIMITS,
  TransactionService,
  TransferService,
} from '@/core/transaction'
import type { TransferSheetState, TransferValues } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { DateRow } from '@/shared/components/date-row'
import {
  CalcAmountField,
  CalcKeypad,
  FORM_IMPORTS,
  TextareaField,
  withMessage,
} from '@/shared/components/form'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import { WalletPick, walletPickItem } from '@/shared/components/wallet-pick'
import type { WalletPickItem } from '@/shared/components/wallet-pick'
import {
  addDays,
  addQuickAmount,
  CALC_KEYBOARD,
  evaluate,
  formatMoney,
  pressKey,
  toDay,
  toMajorText,
} from '@/shared/utils'
import type { CalcKey } from '@/shared/utils'
import { RepeatRow } from './repeat-row'
import { RepeatView } from './repeat-view'
import type { TransferFormGroup } from './transfer-form.type'

type View = 'form' | 'pick' | 'note' | 'repeat'

/**
 * The transfer form (docs/features/transfer.md → Web screens; owner's choice Q4 in #9: a sheet
 * of its own): one card of rows told apart by their icons: from wallet, ⇅ swap, to wallet (each
 * with its balance), amount (the calculator keypad), note (its own view), date. Create (the ⋮
 * menu, the Wallets tab), edit (either row of a transfer; copy and delete in the header) and
 * "fix" a rejected op. Opened through `TransferService.open()`; the shell loads it on first use.
 */
@Component({
  selector: 'app-transfer-sheet',
  imports: [
    FORM_IMPORTS,
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    DateRow,
    WalletPick,
    HlmDrawerImports,
    CalcAmountField,
    CalcKeypad,
    TextareaField,
    IconBadge,
    SheetFrame,
    Slide,
    RepeatRow,
    RepeatView,
  ],
  providers: [
    provideIcons({
      lucideArrowUpDown,
      lucideCheck,
      lucideChevronRight,
      lucideCopy,
      lucideListPlus,
      lucidePause,
      lucidePlay,
      lucideTextAlignStart,
      lucideTrash2,
      lucideWallet,
    }),
  ],
  templateUrl: './transfer-sheet.html',
})
export class TransferSheet {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  protected languageService = inject(LanguageService)
  protected transferService = inject(TransferService)
  protected transactionService = inject(TransactionService)
  protected walletService = inject(WalletService)
  private bookService = inject(BookService)
  private quickAmountsService = inject(QuickAmountsService)
  private recurringService = inject(RecurringService)
  private syncService = inject(SyncService)
  /** "ทำซ้ำ" (docs/features/recurring.md, Q4): null = don't repeat. */
  protected repeat = signal<RepeatValues | null>(null)

  protected readonly sides = ['from', 'to'] as const
  protected walletIcon = WALLET_DEFAULT_ICON
  protected noteMax = TRANSACTION_LIMITS.NOTE_MAX
  protected firstDay = TRANSACTION_LIMITS.FIRST_DAY
  protected state = this.transferService.sheet
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => (this.view() === 'form' ? 0 : 1))
  /** Which wallet the picker view chooses. */
  protected pickSide = signal<'from' | 'to'>('from')
  protected keypad = signal(false)
  /** Quick amounts are Thai banknotes: THB wallets only (currency.md → Web screens). */
  protected quickAmounts = computed(() =>
    this.quickAmountsService.forCurrency(this.fromWallet()?.currencyCode ?? '')
  )

  /** Rule 3: the expression works out to 1 … 10¹⁵ minor units. */
  private amountValid: ValidatorFn = (control) => {
    if (typeof control.value !== 'string') {
      return null
    }
    const walletId: unknown = control.parent?.get('fromWalletId')?.value
    const wallet =
      typeof walletId === 'string' && walletId ? this.walletService.byId(walletId) : null
    const result = evaluate(control.value, this.walletService.minorUnit(wallet?.currencyCode ?? ''))
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

  form: TransferFormGroup = this.nnfb.group({
    fromWalletId: [''],
    toWalletId: ['', [withMessage(Validators.required, 'transfers.toRequired')]],
    amount: ['', [this.amountValid]],
    note: ['', [Validators.maxLength(TRANSACTION_LIMITS.NOTE_MAX)]],
    occurredOn: [toDay()],
  })

  private values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() })
  protected note = computed(() => (this.values().note ?? '').trim())
  protected day = computed(() => this.values().occurredOn ?? toDay())
  protected lastDay = computed(() => addDays(this.transactionService.today(), 365))

  protected editingId = computed(() => {
    const state = this.state()
    return state && state.mode !== 'create' ? state.id : null
  })
  /** The recurring rule being edited (rule mode), if any. */
  protected rule = computed(() => {
    const state = this.state()
    return state?.mode === 'rule' || state?.mode === 'fixRule'
      ? this.recurringService.byId(state.id)
      : null
  })
  private ruleMode = computed(() => {
    const mode = this.state()?.mode
    return mode === 'rule' || mode === 'fixRule'
  })
  /** The credit card being paid (credit-card rule 4): the to wallet is fixed. */
  protected paying = computed(() => {
    const state = this.state()
    return state?.mode === 'create' && state.pay ? state.pay : null
  })
  protected repeatable = computed(() => {
    const state = this.state()
    // A card's bill changes every month, so the pay sheet doesn't repeat.
    return (state?.mode === 'create' && !state.occurrence && !state.pay) || this.ruleMode()
  })
  /**
   * Credit-card rule 5: a new transfer to a card that owes money offers the amount owed, while
   * the amount typed differs from it.
   */
  protected owedChip = computed(() => {
    const to = this.toWallet()
    if (this.state()?.mode !== 'create' || !to?.isCreditCard) {
      return null
    }
    const owed = this.walletService.owed(to)
    const minorUnit = this.walletService.minorUnit(to.currencyCode)
    const typed = evaluate(this.values().amount ?? '', minorUnit)
    if (owed <= 0 || (typed.ok && typed.minor === owed)) {
      return null
    }
    return {
      amount: owed,
      text: formatMoney(owed, to.currencyCode, minorUnit, this.languageService.locale()),
    }
  })
  protected startsRule = computed(() => this.repeatable() && this.repeat() !== null)
  /** A recorded occurrence: the rule it came from, while it's live. */
  protected fromRule = computed(() => {
    this.languageService.language()
    const state = this.state()
    const row = state?.mode === 'edit' ? this.transferService.byId(state.id) : null
    const rule = row?.recurringId ? this.recurringService.byId(row.recurringId) : null
    return rule
      ? {
          id: rule.id,
          text: describeRepeat(rule, rule.startOn, this.t, this.languageService.locale()),
        }
      : null
  })
  protected repeatTitle = computed(() => {
    this.languageService.language()
    const repeat = this.repeat()
    return repeat
      ? describeRepeat(repeat, this.day(), this.t, this.languageService.locale())
      : this.t('recurring.none')
  })
  protected repeatSub = computed(() => {
    this.languageService.language()
    const repeat = this.repeat()
    return repeat ? describeRest(repeat, this.t, this.languageService.locale()) : ''
  })
  protected repeatHint = computed(() => {
    this.languageService.language()
    const repeat = this.repeat()
    const locale = this.languageService.locale()
    if (!repeat || !this.repeatable()) {
      return null
    }
    const day = this.day()
    const today = this.transactionService.today()
    const rule = this.rule()
    if (rule) {
      return [
        rule.nextOn
          ? this.t('recurring.nextLine', { date: shortDate(rule.nextOn, locale) })
          : this.t('recurring.ended'),
        this.t('recurring.recordedLine', { count: this.recurringService.recordedCount(rule) }),
        this.t('recurring.editNote'),
      ].join(' · ')
    }
    if (day > today) {
      return this.t('recurring.nextLine', { date: shortDate(day, locale) })
    }
    const next = nextOnOrAfter({ ...repeat, startOn: day }, addDays(today, 1))
    return next
      ? this.t('recurring.nextNow', {
          date: shortDate(next, locale),
          first: shortDate(day, locale, false),
        })
      : null
  })
  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)

  /** The book the transfer belongs to (rule 1: it never moves). */
  private bookId = computed(() => {
    const state = this.state()
    const rule = this.rule()
    if (rule) {
      return rule.bookId
    }
    const id = this.editingId()
    const row = id ? this.transferService.byId(id) : null
    if (row) {
      return row.bookId
    }
    return state?.mode === 'fix' ? state.bookId : (this.bookService.current()?.id ?? '')
  })
  /** The currency the transfer had when the sheet opened (an edit keeps it, rule 1). */
  private startCurrency = signal<string | null>(null)
  protected fromWallet = computed<Wallet | null>(() => {
    const id = this.values().fromWalletId ?? ''
    return id ? this.walletService.byId(id) : null
  })
  protected toWallet = computed<Wallet | null>(() => {
    const id = this.values().toWalletId ?? ''
    return id ? this.walletService.byId(id) : null
  })
  protected minorUnit = computed(() =>
    this.walletService.minorUnit(this.fromWallet()?.currencyCode ?? '')
  )
  protected heading = computed(() => {
    if (this.paying()) {
      return 'transfers.payHeading'
    }
    switch (this.state()?.mode) {
      case 'edit':
        return 'transfers.editHeading'
      case 'fix':
        return 'transfers.fixHeading'
      case 'rule':
        return 'recurring.editHeading'
      case 'fixRule':
        return 'recurring.fixHeading'
      default:
        return 'transfers.createHeading'
    }
  })

  /** Rule 2: open wallets (and the one the row already has); an edit keeps its currency. */
  protected fromChoices = computed<Wallet[]>(() => {
    const card = this.paying() ? this.walletService.byId(this.paying() ?? '') : null
    // Paying a card: wallets of its currency, never the card itself.
    return card
      ? this.choices(this.fromWallet(), card.currencyCode, card.id)
      : this.choices(this.fromWallet(), this.startCurrency(), null)
  })
  /** Rule 1: open wallets of the from wallet's currency, never the from wallet itself. */
  protected toChoices = computed<Wallet[]>(() => {
    const from = this.fromWallet()
    return this.choices(this.toWallet(), from?.currencyCode ?? null, from?.id ?? null)
  })
  protected fromItems = computed(() => this.pickItems(this.fromChoices()))
  protected toItems = computed(() => this.pickItems(this.toChoices()))

  protected open = signal(false)

  constructor() {
    this.form.controls.fromWalletId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.dropUnfitTo()
      this.form.controls.amount.updateValueAndValidity()
    })
    effect(() => {
      const state = this.state()
      untracked(() => {
        if (state) {
          this.start(state)
        }
        this.open.set(state !== null)
      })
    })
  }

  private pickItems(wallets: readonly Wallet[]): WalletPickItem[] {
    const locale = this.languageService.locale()
    const excluded = this.transloco.translate('wallets.excluded')
    return wallets.map((wallet) =>
      walletPickItem(wallet, {
        balance: this.walletService.balance(wallet),
        minorUnit: this.walletService.minorUnit(wallet.currencyCode),
        locale,
        excluded,
      })
    )
  }

  protected balanceText(wallet: Wallet): string {
    return formatMoney(
      this.walletService.balance(wallet),
      wallet.currencyCode,
      this.walletService.minorUnit(wallet.currencyCode),
      this.languageService.locale()
    )
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

  protected setRepeat(value: RepeatValues | null): void {
    this.repeat.set(value)
    this.form.markAsDirty()
  }

  protected openRule(id: string): void {
    if (!this.form.dirty) {
      this.recurringService.open(id)
    }
  }

  protected togglePause(): void {
    const rule = this.rule()
    if (!rule) {
      return
    }
    this.recurringService.setPaused(rule.id, !rule.isPaused)
    toast.success(this.t(rule.isPaused ? 'recurring.resumed' : 'recurring.paused2'))
  }

  protected pick(view: 'from' | 'to' | 'note' | 'repeat'): void {
    if (view === 'to' && this.paying()) {
      return
    }
    this.settleAmount()
    this.keypad.set(false)
    if (view === 'note' || view === 'repeat') {
      this.view.set(view)
      return
    }
    this.pickSide.set(view)
    this.view.set('pick')
  }

  protected choose(side: 'from' | 'to', id: string): void {
    const control =
      side === 'from' ? this.form.controls.fromWalletId : this.form.controls.toWalletId
    control.setValue(id)
    control.markAsDirty()
    if (
      side === 'from' &&
      !this.form.controls.toWalletId.value &&
      this.state()?.mode === 'create'
    ) {
      this.form.controls.toWalletId.setValue(this.transferService.lastToId(id, this.bookId()) ?? '')
    }
    this.view.set('form')
  }

  /** ⇅: the two wallets change places. */
  protected swap(): void {
    const { fromWalletId, toWalletId } = this.form.getRawValue()
    if (!toWalletId) {
      return
    }
    this.form.patchValue({ fromWalletId: toWalletId, toWalletId: fromWalletId })
    this.form.markAsDirty()
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

  /** Credit-card rule 5: the amount the card owes. */
  protected useOwed(amount: number): void {
    const control = this.form.controls.amount
    control.setValue(toMajorText(amount, this.minorUnit()).replace(/,/g, ''))
    control.markAsDirty()
    this.keypad.set(false)
  }

  protected addQuick(major: number): void {
    const control = this.form.controls.amount
    control.setValue(addQuickAmount(control.value, major, this.minorUnit()))
    control.markAsDirty()
  }

  /** "Copy": a new transfer with the form's values, dated today. */
  protected copy(): void {
    const value = this.form.getRawValue()
    const amount = evaluate(value.amount, this.minorUnit())
    this.transferService.open({
      mode: 'create',
      values: {
        fromWalletId: value.fromWalletId,
        toWalletId: value.toWalletId,
        amount: amount.ok && amount.minor > 0 ? amount.minor : 0,
        occurredOn: this.transactionService.today(),
        note: value.note,
      },
    })
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

  protected save(addAnother = false): void {
    const state = this.state()
    this.settleAmount()
    if (!state || this.form.invalid || !this.transferService.canWrite()) {
      return
    }
    const value = this.form.getRawValue()
    if (!value.fromWalletId) {
      // The pay sheet of a card with no other wallet of its currency to pay from.
      this.pick('from')
      return
    }
    const amount = evaluate(value.amount, this.minorUnit())
    const values: TransferValues = {
      fromWalletId: value.fromWalletId,
      toWalletId: value.toWalletId,
      amount: amount.ok ? amount.minor : 0,
      occurredOn: value.occurredOn,
      note: value.note,
    }
    const repeat = this.repeat()
    const ruleValues = (repeat: RepeatValues): RuleValues => ({
      ...repeat,
      kind: 'transfer',
      walletId: values.fromWalletId,
      categoryId: null,
      toWalletId: values.toWalletId,
      amount: values.amount,
      note: values.note,
      excludeFromReport: false,
      startOn: values.occurredOn,
    })
    // A plain save closes the sheet onto the list that already shows the row, so it gets no
    // toast (owner 2026-11: it only covered the header). "Save and add" keeps the sheet open,
    // so that one still says the row was saved. Rules and due bills aren't on the list: toast.
    let done: string | null = addAnother && state.mode === 'create' ? 'transfers.created' : null
    if (state.mode === 'rule' || state.mode === 'fixRule') {
      this.recurringService.update(
        state.id,
        ruleValues(repeat ?? MONTHLY),
        state.mode === 'fixRule' ? state.opId : null
      )
      done = 'recurring.saved'
    } else if (state.mode === 'fix') {
      this.transferService.save(state.id, values, state.opId, state.bookId)
    } else if (state.mode === 'create' && state.occurrence) {
      this.recurringService.confirm(state.occurrence.ruleId, state.occurrence.on, {
        walletId: values.fromWalletId,
        toWalletId: values.toWalletId,
        amount: values.amount,
        note: values.note,
        occurredOn: values.occurredOn,
      })
      done = 'recurring.confirmed'
    } else if (state.mode === 'create' && repeat) {
      this.recurringService.create(ruleValues(repeat))
      done = 'recurring.created'
    } else {
      // A card's payment too: the Wallets tab shows what's left owed.
      this.transferService.save(this.editingId(), values)
    }
    if (done) {
      toast.success(this.transloco.translate(done))
    }
    if (addAnother && state.mode === 'create') {
      this.form.reset({ ...value, amount: '', note: '' })
      this.keypad.set(true)
      return
    }
    this.finish()
  }

  /** Rule 7: both rows go at once, "เลิกทำ" in the toast. */
  protected remove(): void {
    const id = this.editingId()
    if (!id) {
      return
    }
    if (this.ruleMode()) {
      this.recurringService.remove(id)
      toast(this.transloco.translate('recurring.deleted'), {
        action: {
          label: this.transloco.translate('transactions.undo'),
          onClick: () => this.recurringService.restore(id),
        },
      })
      this.finish()
      return
    }
    this.transferService.remove(id)
    toast(this.transloco.translate('transfers.deleted'), {
      action: {
        label: this.transloco.translate('transactions.undo'),
        onClick: () => this.transferService.restore(id),
      },
    })
    this.finish()
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.state.set(null)
  }

  private choices(
    current: Wallet | null,
    currency: string | null,
    except: string | null
  ): Wallet[] {
    const open = this.walletService
      .openOf(this.bookId())
      .filter((item) => item.id !== except && (currency === null || item.currencyCode === currency))
    return current && current.id !== except && !open.some((item) => item.id === current.id)
      ? [current, ...open]
      : open
  }

  /** A to wallet that is now the from wallet, or of another currency, no longer fits. */
  private dropUnfitTo(): void {
    // The controls, not `values()`: this runs in the from control's own valueChanges, before the
    // form's (which feeds `values()`) has emitted.
    const { fromWalletId, toWalletId } = this.form.getRawValue()
    const from = fromWalletId ? this.walletService.byId(fromWalletId) : null
    const to = toWalletId ? this.walletService.byId(toWalletId) : null
    if (to && (!from || to.id === from.id || to.currencyCode !== from.currencyCode)) {
      this.form.controls.toWalletId.setValue('')
    }
  }

  private settleAmount(): void {
    const control = this.form.controls.amount
    const result = evaluate(control.value, this.minorUnit())
    if (result.ok && result.minor > 0 && /[+\-×÷]/.test(control.value)) {
      control.setValue(toMajorText(result.minor, this.minorUnit()).replace(/,/g, ''))
    }
  }

  /** A rule in this sheet: its template in the form, its schedule in "ทำซ้ำ" (recurring.md). */
  private startRule(state: Extract<TransferSheetState, { mode: 'rule' | 'fixRule' }>): void {
    const stored = this.recurringService.byId(state.id)
    const refused = state.mode === 'fixRule' ? this.syncService.rejectedOp(state.opId)?.row : null
    const source = refused ? toRuleRow(refused) : stored
    if (!source) {
      this.state.set(null)
      return
    }
    const minorUnit = this.walletService.minorUnit(
      this.walletService.byId(source.walletId)?.currencyCode ?? ''
    )
    this.startCurrency.set(null)
    this.form.reset({
      fromWalletId: source.walletId,
      toWalletId: source.toWalletId ?? '',
      amount: source.amount > 0 ? toMajorText(source.amount, minorUnit).replace(/,/g, '') : '',
      note: source.note,
      occurredOn: source.startOn,
    })
    this.repeat.set({
      frequency: source.frequency,
      interval: source.interval,
      endOn: source.endOn,
      endCount: source.endCount,
      confirm: source.confirm,
    })
    this.keypad.set(false)
    if (refused) {
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    }
  }

  /** Credit-card rule 4: to the card, the amount it owes, from the wallet it was last paid from. */
  private startPay(cardId: string): void {
    const card = this.walletService.byId(cardId)
    if (!card) {
      this.state.set(null)
      return
    }
    const owed = this.walletService.owed(card)
    this.startCurrency.set(null)
    this.form.reset({
      fromWalletId: this.transferService.payFromId(card.id) ?? '',
      toWalletId: card.id,
      amount:
        owed > 0
          ? toMajorText(owed, this.walletService.minorUnit(card.currencyCode)).replace(/,/g, '')
          : '',
      note: '',
      occurredOn: this.transactionService.today(),
    })
    this.keypad.set(owed <= 0)
  }

  private start(state: TransferSheetState): void {
    this.view.set('form')
    this.repeat.set(state.mode === 'create' && state.repeat ? MONTHLY : null)
    if (state.mode === 'rule' || state.mode === 'fixRule') {
      this.startRule(state)
      return
    }
    if (state.mode === 'create' && state.pay) {
      this.startPay(state.pay)
      return
    }
    if (state.mode === 'create') {
      const copied = state.values ?? null
      const viewing = this.transactionService.viewWallet()
      const usable = (id: string | null | undefined) => {
        const wallet = id ? this.walletService.byId(id) : null
        return wallet && !wallet.isArchived ? wallet.id : null
      }
      const fromId =
        usable(copied?.fromWalletId) ??
        usable(state.fromWalletId) ??
        usable(viewing?.id) ??
        this.transferService.defaultFromId() ??
        ''
      const toId = usable(copied?.toWalletId) ?? this.transferService.lastToId(fromId) ?? ''
      this.startCurrency.set(null)
      this.form.reset({
        fromWalletId: fromId,
        toWalletId: toId,
        amount:
          copied && copied.amount > 0
            ? toMajorText(
                copied.amount,
                this.walletService.minorUnit(this.walletService.byId(fromId)?.currencyCode ?? '')
              ).replace(/,/g, '')
            : '',
        note: copied?.note ?? '',
        occurredOn: state.occurrence?.on ?? this.transactionService.today(),
      })
      this.dropUnfitTo()
      this.keypad.set(true)
      return
    }
    const values = state.mode === 'fix' ? state.values : this.transferService.byId(state.id)
    if (!values) {
      this.state.set(null)
      return
    }
    const stored = this.transferService.byId(state.id)
    this.startCurrency.set(
      stored ? (this.walletService.byId(stored.fromWalletId)?.currencyCode ?? null) : null
    )
    const minorUnit = this.walletService.minorUnit(
      this.walletService.byId(values.fromWalletId)?.currencyCode ?? ''
    )
    this.form.reset({
      fromWalletId: values.fromWalletId,
      toWalletId: values.toWalletId,
      amount: values.amount > 0 ? toMajorText(values.amount, minorUnit).replace(/,/g, '') : '',
      note: values.note,
      occurredOn: values.occurredOn,
    })
    if (state.mode === 'fix') {
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    }
    this.keypad.set(false)
  }
}
