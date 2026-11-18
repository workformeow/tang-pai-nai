import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
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
  describeRepeatHint,
  describeRest,
  MONTHLY,
  RecurringService,
  toRule as toRuleRow,
} from '@/core/recurring'
import type { RepeatValues } from '@/core/recurring'
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
  AmountKeypad,
  amountValidator,
  CalcAmountField,
  CalcKeypad,
  FORM_IMPORTS,
  TextareaField,
  withMessage,
} from '@/shared/components/form'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import { RepeatRow } from '@/shared/components/repeat-row'
import { keepWhileClosing, SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import { WalletPick, walletPickItem } from '@/shared/components/wallet-pick'
import type { WalletPickItem } from '@/shared/components/wallet-pick'
import { addDays, amountText, formatMoney, toDay, parseMajor } from '@/shared/utils'
import { RepeatView } from '@/sheets/repeat-view/repeat-view'
import { toRuleValues } from './transfer-values'
import type { TransferFormGroup } from './transfer-form.type'

type View = 'form' | 'pick' | 'note' | 'repeat'
type Side = 'from' | 'to'
type StartState<M extends TransferSheetState['mode']> = Extract<TransferSheetState, { mode: M }>

/**
 * The transfer form (docs/features/transfer.md → Web screens; owner's choice Q4 in #9: a sheet
 * of its own): one card of rows told apart by their icons: from wallet, ⇅ swap, to wallet (each
 * with its balance), amount (the calculator keypad), note (its own view), date. Create (the ⋮
 * menu, the Wallets tab), pay a credit card (credit-card rule 4), edit (either row of a transfer;
 * copy and delete in the header), "fix" a rejected op, and a transfer recurring rule (rule mode).
 * Opened through `TransferService.open()`; the shell loads it on first use.
 */
@Component({
  selector: 'app-transfer-sheet',
  imports: [
    FORM_IMPORTS,
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmDrawerImports,
    DateRow,
    WalletPick,
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
  private recurringService = inject(RecurringService)
  private quickAmountsService = inject(QuickAmountsService)
  private syncService = inject(SyncService)

  protected readonly sides: readonly Side[] = ['from', 'to']
  protected walletIcon = WALLET_DEFAULT_ICON
  protected noteMax = TRANSACTION_LIMITS.NOTE_MAX
  protected firstDay = TRANSACTION_LIMITS.FIRST_DAY

  // ── The sheet ─────────────────────────────────────────────────────────────

  /** What the sheet is open for; null = closed. Set by `TransferService.open()`. */
  protected state = keepWhileClosing(this.transferService.sheet)
  protected open = signal(false)
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => (this.view() === 'form' ? 0 : 1))
  /** Which wallet the picker view chooses. */
  protected pickSide = signal<Side>('from')

  // ── The form ──────────────────────────────────────────────────────────────

  form: TransferFormGroup = this.nnfb.group({
    fromWalletId: [''],
    toWalletId: ['', [withMessage(Validators.required, 'transfers.toRequired')]],
    amount: [
      '',
      [
        amountValidator(
          'fromWalletId',
          (id) => this.minorUnitOf(id),
          TRANSACTION_LIMITS.AMOUNT_MAX
        ),
      ],
    ],
    note: ['', [Validators.maxLength(TRANSACTION_LIMITS.NOTE_MAX)]],
    occurredOn: [toDay()],
  })

  /** The amount row's keypad: opens by itself when adding. */
  protected keypad = new AmountKeypad(this.form.controls.amount, () => this.minorUnit())

  private values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() })
  protected note = computed(() => (this.values().note ?? '').trim())
  protected day = computed(() => this.values().occurredOn ?? toDay())
  protected lastDay = computed(() => addDays(this.transactionService.today(), 365))

  // ── Mode: what is being created or edited ─────────────────────────────────

  /** The transfer being edited (edit and fix), or the rule (rule mode); null when creating. */
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

  // ── Wallets and amount ────────────────────────────────────────────────────

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
  /** The amount is in the from wallet's currency. */
  protected minorUnit = computed(() =>
    this.walletService.minorUnit(this.fromWallet()?.currencyCode ?? '')
  )
  /** Quick amounts are Thai banknotes: THB wallets only (currency.md → Web screens). */
  protected quickAmounts = computed(() =>
    this.quickAmountsService.forCurrency(this.fromWallet()?.currencyCode ?? '')
  )
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
    const typed = parseMajor(this.values().amount ?? '', minorUnit)
    if (owed <= 0 || (typed.ok && typed.minor === owed)) {
      return null
    }
    return {
      amount: owed,
      text: formatMoney(owed, to.currencyCode, minorUnit, this.languageService.locale()),
    }
  })

  // ── "ทำซ้ำ" (recurring.md Q4: a transfer repeats like a transaction) ─────────

  /** The schedule; null = don't repeat. */
  protected repeat = signal<RepeatValues | null>(null)
  protected repeatable = computed(() => {
    const state = this.state()
    // A card's bill changes every month, so the pay sheet doesn't repeat.
    return (state?.mode === 'create' && !state.occurrence && !state.pay) || this.ruleMode()
  })
  /** The date row starts the rule ("เริ่ม"). */
  protected startsRule = computed(() => this.repeatable() && this.repeat() !== null)
  /** A recorded occurrence: the rule it came from, while it's live. */
  protected fromRule = computed(() => {
    this.languageService.language()
    const state = this.state()
    const row = state?.mode === 'edit' ? this.transferService.byId(state.id) : null
    const rule = row?.recurringId ? this.recurringService.byId(row.recurringId) : null
    return rule ? { id: rule.id, text: this.describe(rule, rule.startOn) } : null
  })
  protected repeatTitle = computed(() => {
    this.languageService.language()
    const repeat = this.repeat()
    return repeat ? this.describe(repeat, this.day()) : this.t('recurring.none')
  })
  protected repeatSub = computed(() => {
    this.languageService.language()
    const repeat = this.repeat()
    return repeat ? describeRest(repeat, this.t, this.languageService.locale()) : ''
  })
  /** The line under the card: the next date, and on a rule what is recorded already. */
  protected repeatHint = computed(() => {
    this.languageService.language()
    const repeat = this.repeat()
    if (!repeat || !this.repeatable()) {
      return null
    }
    const rule = this.rule()
    return describeRepeatHint(
      repeat,
      this.day(),
      this.transactionService.today(),
      rule ? { nextOn: rule.nextOn, recorded: this.recurringService.recordedCount(rule) } : null,
      this.t,
      this.languageService.locale()
    )
  })

  constructor() {
    // A to wallet that is now the from wallet, or of another currency, no longer fits (rule 1).
    this.form.controls.fromWalletId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.dropUnfitTo()
      this.form.controls.amount.updateValueAndValidity()
    })
    effect(() => {
      const state = this.transferService.sheet()
      untracked(() => {
        if (state) {
          this.start(state)
        }
        this.open.set(state !== null)
      })
    })
  }

  // ── Template actions: rows and pickers ────────────────────────────────────

  /** Another row: the expression settles and the keypad closes. */
  protected pick(view: Side | 'note' | 'repeat'): void {
    if (view === 'to' && this.paying()) {
      return
    }
    this.keypad.close()
    if (view === 'note' || view === 'repeat') {
      this.view.set(view)
      return
    }
    this.pickSide.set(view)
    this.view.set('pick')
  }

  /** The picker's wallet; a new transfer's first from wallet brings its usual to wallet. */
  protected choose(side: Side, id: string): void {
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

  /** Credit-card rule 5: the amount the card owes. */
  protected useOwed(amount: number): void {
    const control = this.form.controls.amount
    control.setValue(amountText(amount, this.minorUnit()))
    control.markAsDirty()
    this.keypad.open.set(false)
  }

  protected balanceText(wallet: Wallet): string {
    return formatMoney(
      this.walletService.balance(wallet),
      wallet.currencyCode,
      this.walletService.minorUnit(wallet.currencyCode),
      this.languageService.locale()
    )
  }

  /** "ทำซ้ำ" changed in its view: the form now holds unsaved input. */
  protected setRepeat(value: RepeatValues | null): void {
    this.repeat.set(value)
    this.form.markAsDirty()
  }

  /** "จากรายการซ้ำ": the rule in this sheet, once nothing here is left unsaved. */
  protected openRule(id: string): void {
    if (!this.form.dirty) {
      this.recurringService.open(id)
    }
  }

  // ── Template actions: header and footer ───────────────────────────────────

  /** Recurring rule 5: pause or resume, at once. */
  protected togglePause(): void {
    const rule = this.rule()
    if (!rule) {
      return
    }
    this.recurringService.setPaused(rule.id, !rule.isPaused)
    toast.success(this.t(rule.isPaused ? 'recurring.resumed' : 'recurring.paused2'))
  }

  /** "Copy": a new transfer with the form's values, dated today. */
  protected copy(): void {
    const value = this.form.getRawValue()
    const amount = parseMajor(value.amount, this.minorUnit())
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

  /** `addAnother` (adding only): the sheet stays with an empty amount and note. */
  protected save(addAnother = false): void {
    const state = this.state()
    if (!state || this.form.invalid || !this.transferService.canWrite()) {
      return
    }
    const value = this.form.getRawValue()
    if (!value.fromWalletId) {
      // The pay sheet of a card with no other wallet of its currency to pay from.
      this.pick('from')
      return
    }
    const amount = parseMajor(value.amount, this.minorUnit())
    const values: TransferValues = {
      fromWalletId: value.fromWalletId,
      toWalletId: value.toWalletId,
      amount: amount.ok ? amount.minor : 0,
      occurredOn: value.occurredOn,
      note: value.note,
    }
    const repeat = this.repeat()
    // A plain save closes the sheet onto the list that already shows the row, so it gets no
    // toast (owner 2026-11: it only covered the header). "Save and add" keeps the sheet open,
    // so that one still says the row was saved. Rules and due bills aren't on the list: toast.
    let done: string | null = addAnother && state.mode === 'create' ? 'transfers.created' : null
    if (state.mode === 'rule' || state.mode === 'fixRule') {
      this.recurringService.update(
        state.id,
        toRuleValues(repeat ?? MONTHLY, values),
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
      this.recurringService.create(toRuleValues(repeat, values))
      done = 'recurring.created'
    } else {
      // A card's payment too: the Wallets tab shows what's left owed.
      this.transferService.save(this.editingId(), values)
    }
    if (done) {
      toast.success(this.t(done))
    }
    if (addAnother && state.mode === 'create') {
      this.form.reset({ ...value, amount: '', note: '' })
      this.keypad.open.set(true)
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
      toast(this.t('recurring.deleted'), {
        action: {
          label: this.t('transactions.undo'),
          onClick: () => this.recurringService.restore(id),
        },
      })
      this.finish()
      return
    }
    this.transferService.remove(id)
    toast(this.t('transfers.deleted'), {
      action: {
        label: this.t('transactions.undo'),
        onClick: () => this.transferService.restore(id),
      },
    })
    this.finish()
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.transferService.sheet.set(null)
  }

  // ── Opening the sheet: the form starts from the state ─────────────────────

  private start(state: TransferSheetState): void {
    this.view.set('form')
    this.repeat.set(state.mode === 'create' && state.repeat ? MONTHLY : null)
    switch (state.mode) {
      case 'create':
        if (state.pay) {
          this.startPay(state.pay)
        } else {
          this.startCreate(state)
        }
        return
      case 'edit':
      case 'fix':
        this.startEdit(state)
        return
      case 'rule':
      case 'fixRule':
        this.startRule(state)
        return
    }
  }

  /** The ⋮ menu or the Wallets tab, a copy, a due bill (recurring rule 10) or the rules page's +. */
  private startCreate(state: StartState<'create'>): void {
    const copied = state.values ?? null
    const viewing = this.transactionService.viewWallet()
    // Rule 2: an archived wallet (of a copy, or the one being viewed) starts as a new add would.
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
      amount: amountText(copied?.amount ?? 0, this.minorUnitOf(fromId)),
      note: copied?.note ?? '',
      occurredOn: state.occurrence?.on ?? this.transactionService.today(),
    })
    this.dropUnfitTo()
    this.keypad.open.set(true)
  }

  /** Credit-card rule 4: to the card, the amount it owes, from the wallet it was last paid from. */
  private startPay(cardId: string): void {
    const card = this.walletService.byId(cardId)
    if (!card) {
      this.transferService.sheet.set(null)
      return
    }
    const owed = this.walletService.owed(card)
    this.startCurrency.set(null)
    this.form.reset({
      fromWalletId: this.transferService.payFromId(card.id) ?? '',
      toWalletId: card.id,
      amount: amountText(owed, this.walletService.minorUnit(card.currencyCode)),
      note: '',
      occurredOn: this.transactionService.today(),
    })
    this.keypad.open.set(owed <= 0)
  }

  /** A row from the list, or "fix" a rejected op (its refused values, errors showing). */
  private startEdit(state: StartState<'edit' | 'fix'>): void {
    const stored = this.transferService.byId(state.id)
    const values = state.mode === 'fix' ? state.values : stored
    if (!values) {
      this.transferService.sheet.set(null)
      return
    }
    this.startCurrency.set(
      stored ? (this.walletService.byId(stored.fromWalletId)?.currencyCode ?? null) : null
    )
    this.form.reset({
      fromWalletId: values.fromWalletId,
      toWalletId: values.toWalletId,
      amount: amountText(values.amount, this.minorUnitOf(values.fromWalletId)),
      note: values.note,
      occurredOn: values.occurredOn,
    })
    if (state.mode === 'fix') {
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    }
    this.keypad.open.set(false)
  }

  /** A rule in this sheet: its template in the form, its schedule in "ทำซ้ำ" (recurring.md). */
  private startRule(state: StartState<'rule' | 'fixRule'>): void {
    const stored = this.recurringService.byId(state.id)
    const refused = state.mode === 'fixRule' ? this.syncService.rejectedOp(state.opId)?.row : null
    const source = refused ? toRuleRow(refused) : stored
    if (!source) {
      this.transferService.sheet.set(null)
      return
    }
    this.startCurrency.set(null)
    this.form.reset({
      fromWalletId: source.walletId,
      toWalletId: source.toWalletId ?? '',
      amount: amountText(source.amount, this.minorUnitOf(source.walletId)),
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
    this.keypad.open.set(false)
    if (refused) {
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Open wallets of `currency` (any when null) except `except`, and `current` if it isn't. */
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

  /** The picker's rows, each with its balance. */
  private pickItems(wallets: readonly Wallet[]): WalletPickItem[] {
    const locale = this.languageService.locale()
    const excluded = this.t('wallets.excluded')
    return wallets.map((wallet) =>
      walletPickItem(wallet, {
        balance: this.walletService.balance(wallet),
        minorUnit: this.walletService.minorUnit(wallet.currencyCode),
        locale,
        excluded,
      })
    )
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

  /** A wallet's minor unit, read from the control (the validator runs before `fromWallet()`). */
  private minorUnitOf(walletId: string): number {
    const wallet = walletId ? this.walletService.byId(walletId) : null
    return this.walletService.minorUnit(wallet?.currencyCode ?? '')
  }

  private describe(repeat: RepeatValues, startOn: string): string {
    return describeRepeat(repeat, startOn, this.t, this.languageService.locale())
  }

  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)
}
