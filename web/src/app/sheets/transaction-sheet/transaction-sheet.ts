import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideCopy,
  lucideEyeOff,
  lucideHandCoins,
  lucideListPlus,
  lucidePause,
  lucidePlane,
  lucidePlay,
  lucideTextAlignStart,
  lucideTrash2,
  lucideX,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import type { Category, CategoryType } from '@/core/category'
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
import { QuickAmountsService, TRANSACTION_LIMITS, TransactionService } from '@/core/transaction'
import type { EventOption, TransactionSheetState, TransactionValues } from '@/core/transaction'
import { isHiddenIn, WalletService } from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { DateRow } from '@/shared/components/date-row'
import {
  AmountKeypad,
  amountValidator,
  CalcAmountField,
  CalcKeypad,
  FORM_IMPORTS,
  SwitchField,
  TextareaField,
  withMessage,
} from '@/shared/components/form'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { RepeatRow } from '@/shared/components/repeat-row'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import { WalletPick, walletPickItem } from '@/shared/components/wallet-pick'
import { addDays, amountText, toDay, parseMajor } from '@/shared/utils'
import { EventPick } from '@/sheets/event-pick/event-pick'
import { RepeatView } from '@/sheets/repeat-view/repeat-view'
import { TransactionCategoryPick } from '@/sheets/transaction-category-pick/transaction-category-pick'
import { toRuleValues } from './transaction-values'
import type { TransactionFormGroup } from './transaction-form.type'

type View = 'form' | 'wallet' | 'category' | 'note' | 'repeat' | 'event'
type StartState<M extends TransactionSheetState['mode']> = Extract<
  TransactionSheetState,
  { mode: M }
>

/**
 * The transaction form (docs/features/transaction.md → Web screens; owner's choices in #8): the
 * type tabs, then one card of rows told apart by their icons (no labels above them): wallet,
 * amount (an on-screen calculator keypad), category, note (its own view), date (‹ › a day, the
 * middle opens the date picker) and "ไม่รวมในรายงาน". Create (➕), edit (a row; delete in the
 * header, undo in the toast) and "fix" a rejected op. A recurring rule opens here too (rule
 * mode). Opened through `TransactionService.open()`; the shell loads it on first use.
 *
 * The category and event pickers are their own components; the other views are short and read
 * the form directly, so they stay here.
 */
@Component({
  selector: 'app-transaction-sheet',
  imports: [
    FORM_IMPORTS,
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmDrawerImports,
    DateRow,
    WalletPick,
    SwitchField,
    CalcAmountField,
    CalcKeypad,
    TextareaField,
    IconBadge,
    SheetFrame,
    Slide,
    RepeatRow,
    RepeatView,
    TransactionCategoryPick,
    EventPick,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideCopy,
      lucideEyeOff,
      lucideHandCoins,
      lucideListPlus,
      lucidePause,
      lucidePlane,
      lucidePlay,
      lucideTextAlignStart,
      lucideTrash2,
      lucideX,
    }),
  ],
  templateUrl: './transaction-sheet.html',
})
export class TransactionSheet {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private router = inject(Router)
  protected languageService = inject(LanguageService)
  protected transactionService = inject(TransactionService)
  protected bookService = inject(BookService)
  private walletService = inject(WalletService)
  private categoryService = inject(CategoryService)
  private recurringService = inject(RecurringService)
  private quickAmountsService = inject(QuickAmountsService)
  private syncService = inject(SyncService)

  protected walletIcon = WALLET_DEFAULT_ICON
  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected noteMax = TRANSACTION_LIMITS.NOTE_MAX
  protected firstDay = TRANSACTION_LIMITS.FIRST_DAY

  // ── The sheet ─────────────────────────────────────────────────────────────

  /** What the sheet is open for; null = closed. Set by `TransactionService.open()`. */
  protected state = this.transactionService.sheet
  protected open = signal(false)
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => (this.view() === 'form' ? 0 : 1))
  /** The folded "เพิ่มเติม" options. */
  protected more = signal(false)

  // ── The form ──────────────────────────────────────────────────────────────

  form: TransactionFormGroup = this.nnfb.group({
    type: ['expense'],
    walletId: [''],
    amount: [
      '',
      [amountValidator('walletId', (id) => this.minorUnitOf(id), TRANSACTION_LIMITS.AMOUNT_MAX)],
    ],
    categoryId: ['', [withMessage(Validators.required, 'transactions.categoryRequired')]],
    note: ['', [Validators.maxLength(TRANSACTION_LIMITS.NOTE_MAX)]],
    occurredOn: [toDay()],
    excludeFromReport: [false],
  })

  /** The amount row's keypad: opens by itself when adding (owner's choice in #8). */
  protected keypad = new AmountKeypad(this.form.controls.amount, () => this.minorUnit())

  private values = toSignal(this.form.valueChanges, { initialValue: this.form.getRawValue() })
  protected note = computed(() => (this.values().note ?? '').trim())
  protected day = computed(() => this.values().occurredOn ?? toDay())
  protected lastDay = computed(() => addDays(this.transactionService.today(), 365))
  protected category = computed<Category | null>(() => {
    const id = this.values().categoryId ?? ''
    return id ? this.categoryService.byId(id) : null
  })

  // ── Mode: what is being created or edited ─────────────────────────────────

  /** The transaction being edited (edit and fix), null when creating. */
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
  /** The book the row belongs to (rule 1: it never moves). */
  protected bookId = computed(() => {
    const state = this.state()
    const rule = this.rule()
    if (rule) {
      return rule.bookId
    }
    const id = this.editingId()
    const row = id ? this.transactionService.byId(id) : null
    if (row) {
      return row.bookId
    }
    return state?.mode === 'fix' ? state.bookId : (this.bookService.current()?.id ?? '')
  })
  protected heading = computed(() => {
    switch (this.state()?.mode) {
      case 'edit':
        return 'transactions.editHeading'
      case 'fix':
        return 'transactions.fixHeading'
      case 'rule':
        return 'recurring.editHeading'
      case 'fixRule':
        return 'recurring.fixHeading'
      default:
        return 'transactions.createHeading'
    }
  })
  /** Why nothing can be saved: a viewer of a shared book, else no network / server. */
  protected readOnlyKey = computed(() => {
    const shared = this.bookService.shared()
    if (shared?.role === 'viewer') {
      return 'sharing.viewerReadOnly'
    }
    return this.transactionService.serverDown()
      ? 'sync.serverDownWrite'
      : 'transactions.needsOnline'
  })

  // ── Wallet and amount ─────────────────────────────────────────────────────

  /** The wallet the row had when the sheet opened (rule 5 keeps its currency). */
  private startWalletId = signal<string | null>(null)
  protected wallet = computed<Wallet | null>(() => {
    const id = this.values().walletId ?? ''
    return id ? this.walletService.byId(id) : null
  })
  protected minorUnit = computed(() =>
    this.walletService.minorUnit(this.wallet()?.currencyCode ?? '')
  )
  /**
   * The keypad's quick amounts (8.2): Thai banknotes, so THB wallets only (currency.md → Web
   * screens), none when turned off in Account › การแสดงผล.
   */
  protected quickAmounts = computed(() =>
    this.quickAmountsService.forCurrency(this.wallet()?.currencyCode ?? '')
  )
  /** Rule 5: when editing, only wallets in the row's currency. */
  protected sameCurrencyOnly = computed(() => {
    const start = this.startWalletId()
    return start ? (this.walletService.byId(start)?.currencyCode ?? null) : null
  })
  /** Rule 2: the book's open wallets (and the one the row already has). */
  protected walletChoices = computed<Wallet[]>(() => {
    const currency = this.editingId() ? this.sameCurrencyOnly() : null
    const open = this.walletService
      .openOf(this.bookId())
      .filter((item) => currency === null || item.currencyCode === currency)
    const current = this.wallet()
    return current && !open.some((item) => item.id === current.id) ? [current, ...open] : open
  })
  protected walletItems = computed(() =>
    this.walletChoices().map((wallet) => walletPickItem(wallet))
  )

  // ── Event / trip (event.md) ───────────────────────────────────────────────

  /** The event / trip it is tagged to (event rule 3); an edit keeps it. */
  protected eventId = signal<string | null>(null)
  /** Chosen by hand (or kept from the row): the date no longer picks it (event rule 5). */
  private eventChosen = signal(false)
  /** The open events the picker offers, and the row's own (closed) one. */
  protected eventChoices = computed<EventOption[]>(() =>
    this.transactionService.eventOptions(this.bookId(), this.eventId())
  )
  protected event = computed(() => {
    const id = this.eventId()
    return id ? (this.eventChoices().find((item) => item.id === id) ?? null) : null
  })
  /** Rules carry no event (event rule 9), nor does "ทำซ้ำ". */
  protected showEvent = computed(
    () =>
      !this.ruleMode() &&
      this.repeat() === null &&
      (this.eventChoices().length > 0 || this.eventId() !== null)
  )

  // ── Debt (debt.md) ────────────────────────────────────────────────────────

  /** The debt this row belongs to (debt rule 3: an instalment, interest), kept by an edit. */
  protected debtId = signal<string | null>(null)
  protected debtLink = computed(() => {
    const id = this.debtId()
    const person = this.transactionService.debtPerson(id)
    return id && person !== null ? { id, person } : null
  })

  // ── "ทำซ้ำ" (recurring.md) ─────────────────────────────────────────────────

  /** The schedule; null = don't repeat. */
  protected repeat = signal<RepeatValues | null>(null)
  /** "ทำซ้ำ" shows when adding (not a due occurrence) and on a rule. */
  protected repeatable = computed(() => {
    const state = this.state()
    // A shared book has no recurring rules (sharing rule 11).
    if (this.bookService.isShared()) {
      return false
    }
    return (state?.mode === 'create' && !state.occurrence) || this.ruleMode()
  })
  /** The date row starts the rule ("เริ่ม"). */
  protected startsRule = computed(() => this.repeatable() && this.repeat() !== null)
  /** A recorded occurrence: the rule it came from, while it's live. */
  protected fromRule = computed(() => {
    this.languageService.language()
    const state = this.state()
    const row = state?.mode === 'edit' ? this.transactionService.byId(state.id) : null
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
    // A category of the other type, or one the new wallet hides, no longer fits (rule 2).
    this.form.controls.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.dropUnfit())
    this.form.controls.walletId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.dropUnfit()
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
    // Event rule 5: while adding, the date picks the event until one is chosen by hand.
    effect(() => {
      const state = this.state()
      const day = this.day()
      const bookId = this.bookId()
      if (state?.mode !== 'create' || this.eventChosen()) {
        return
      }
      this.eventId.set(untracked(() => this.transactionService.defaultEventId(bookId, day)))
    })
  }

  // ── Template actions: rows and pickers ────────────────────────────────────

  /** Another row: the expression settles and the keypad closes, as in Money Lover. */
  protected pick(view: Exclude<View, 'form'>): void {
    this.keypad.close()
    this.view.set(view)
  }

  protected chooseWallet(id: string): void {
    this.form.controls.walletId.setValue(id)
    this.form.controls.walletId.markAsDirty()
    this.view.set('form')
  }

  protected chooseCategory(id: string): void {
    const type = this.categoryService.byId(id)?.type
    if (type && type !== this.form.controls.type.value) {
      // Before the category, so the type's change doesn't drop it (`dropUnfit`).
      this.form.controls.type.setValue(type)
      this.form.controls.type.markAsDirty()
    }
    this.form.controls.categoryId.setValue(id)
    this.form.controls.categoryId.markAsDirty()
    this.view.set('form')
  }

  /** The event picker's choice (or ×): kept from now on, whatever the date (event rule 5). */
  protected chooseEvent(id: string | null): void {
    this.eventId.set(id)
    this.eventChosen.set(true)
    this.form.markAsDirty()
    this.view.set('form')
  }

  /** "ทำซ้ำ" changed in its view: the form now holds unsaved input. */
  protected setRepeat(value: RepeatValues | null): void {
    this.repeat.set(value)
    this.form.markAsDirty()
  }

  /** "จากรายการซ้ำ": the rule in this sheet. */
  protected openRule(id: string): void {
    if (this.form.dirty) {
      return
    }
    this.recurringService.open(id)
  }

  /** The "หนี้" row: the debt's page, once nothing here is left unsaved. */
  protected openDebt(id: string): void {
    if (this.form.dirty) {
      return
    }
    this.finish()
    void this.router.navigate(['/wallets/debts', id])
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

  /**
   * "Copy" (8.2): "เพิ่มธุรกรรม" with the form's values and today's date; the row being edited
   * stays as it was saved.
   */
  protected copy(): void {
    const value = this.form.getRawValue()
    const amount = parseMajor(value.amount, this.minorUnit())
    this.transactionService.open({
      mode: 'create',
      type: value.type as CategoryType,
      values: {
        walletId: value.walletId,
        categoryId: value.categoryId,
        amount: amount.ok && amount.minor > 0 ? amount.minor : 0,
        occurredOn: this.transactionService.today(),
        note: value.note,
        excludeFromReport: value.excludeFromReport,
        debtId: this.debtId(),
        eventId: this.eventId(),
      },
    })
  }

  /** `addAnother` (8.2, adding only): the sheet stays with an empty amount and note. */
  protected save(addAnother = false): void {
    const state = this.state()
    if (!state || this.form.invalid || !this.transactionService.canWrite()) {
      return
    }
    const value = this.form.getRawValue()
    const amount = parseMajor(value.amount, this.minorUnit())
    const values: TransactionValues = {
      walletId: value.walletId,
      categoryId: value.categoryId,
      amount: amount.ok ? amount.minor : 0,
      occurredOn: value.occurredOn,
      note: value.note,
      excludeFromReport: value.excludeFromReport,
      debtId: this.debtId(),
      // A rule carries no event (event rule 9), so neither does what "ทำซ้ำ" records.
      eventId: this.repeat() && state.mode === 'create' ? null : this.eventId(),
    }
    const repeat = this.repeat()
    // A plain save closes the sheet onto the list that already shows the row, so it gets no
    // toast (owner 2026-11: it only covered the header). "Save and add" keeps the sheet open,
    // so that one still says the row was saved. Rules and due bills aren't on the list: toast.
    let done: string | null = addAnother && state.mode === 'create' ? 'transactions.created' : null
    if (state.mode === 'rule' || state.mode === 'fixRule') {
      // A rule stays a rule: "ไม่ทำซ้ำ" isn't offered on one (delete it instead).
      this.recurringService.update(
        state.id,
        toRuleValues(repeat ?? MONTHLY, values),
        state.mode === 'fixRule' ? state.opId : null
      )
      done = 'recurring.saved'
    } else if (state.mode === 'fix') {
      this.transactionService.save(state.id, values, state.opId, state.bookId)
    } else if (state.mode === 'create' && state.occurrence) {
      // Recurring rule 10: this month's bill, recorded as the due occurrence.
      this.recurringService.confirm(state.occurrence.ruleId, state.occurrence.on, values)
      done = 'recurring.confirmed'
    } else if (state.mode === 'create' && repeat) {
      this.recurringService.create(toRuleValues(repeat, values))
      done = 'recurring.created'
    } else {
      this.transactionService.save(this.editingId(), values)
    }
    if (state.mode === 'create') {
      this.transactionService.rememberType(value.type as CategoryType)
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

  /** Rule 7: a tombstone at once, "เลิกทำ" in the toast. */
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
    this.transactionService.remove(id)
    toast(this.t('transactions.deleted'), {
      action: {
        label: this.t('transactions.undo'),
        onClick: () => this.transactionService.restore(id),
      },
    })
    this.finish()
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.state.set(null)
  }

  // ── Opening the sheet: the form starts from the state ─────────────────────

  private start(state: TransactionSheetState): void {
    this.debtId.set(this.startDebtId(state))
    const startEvent = this.startEventId(state)
    this.eventId.set(startEvent ?? null)
    this.eventChosen.set(startEvent !== undefined)
    this.view.set('form')
    this.more.set(state.mode !== 'create' && this.startValues(state)?.excludeFromReport === true)
    this.repeat.set(state.mode === 'create' && state.repeat ? MONTHLY : null)
    switch (state.mode) {
      case 'create':
        this.startCreate(state)
        return
      case 'edit':
        this.startEdit(state)
        return
      case 'fix':
        this.startFix(state)
        return
      case 'rule':
      case 'fixRule':
        this.startRule(state)
        return
    }
  }

  /** ➕, a copy (8.2), a due bill (recurring rule 10) or the rules page's + (recurring.md). */
  private startCreate(state: StartState<'create'>): void {
    const viewing = this.transactionService.viewWallet()
    const copied = state.values ?? null
    const copiedWallet = copied ? this.walletService.byId(copied.walletId) : null
    // Rule 2: a copy of a row in an archived wallet starts as a new add would.
    const walletId =
      (copiedWallet && !copiedWallet.isArchived ? copiedWallet.id : null) ??
      state.walletId ??
      (viewing && !viewing.isArchived ? viewing.id : null) ??
      this.transactionService.defaultWalletId() ??
      ''
    const copiedCategory = copied ? this.categoryService.byId(copied.categoryId) : null
    this.startWalletId.set(null)
    this.more.set(copied?.excludeFromReport === true)
    this.form.reset({
      type: state.type ?? this.transactionService.lastType(),
      walletId,
      amount: amountText(
        copied?.amount ?? 0,
        this.walletService.minorUnit(copiedWallet?.currencyCode ?? '')
      ),
      categoryId: copiedCategory && !copiedCategory.isArchived ? copiedCategory.id : '',
      note: copied?.note ?? '',
      occurredOn: state.occurrence?.on ?? state.occurredOn ?? this.transactionService.today(),
      excludeFromReport: copied?.excludeFromReport ?? false,
    })
    this.dropUnfit()
    this.keypad.open.set(true)
    // The rules page's +: "ทำซ้ำ" shows set, under an open "เพิ่มเติม".
    if (state.repeat || this.debtId()) {
      this.more.set(true)
    }
  }

  /** A row from the list. */
  private startEdit(state: StartState<'edit'>): void {
    const row = this.transactionService.byId(state.id)
    if (!row) {
      this.state.set(null)
      return
    }
    if (row.recurringId || row.debtId) {
      this.more.set(true)
    }
    this.startWalletId.set(row.walletId)
    this.form.reset(this.toForm(row))
    this.keypad.open.set(false)
  }

  /** "Fix" a rejected op: its refused values, errors showing. */
  private startFix(state: StartState<'fix'>): void {
    this.startWalletId.set(this.transactionService.byId(state.id)?.walletId ?? null)
    this.form.reset(this.toForm(state.values))
    this.form.markAllAsTouched()
    this.form.markAsDirty()
    this.keypad.open.set(false)
  }

  /** A rule in this sheet: its template in the form, its schedule in "ทำซ้ำ" (recurring.md). */
  private startRule(state: StartState<'rule' | 'fixRule'>): void {
    const stored = this.recurringService.byId(state.id)
    const refused = state.mode === 'fixRule' ? this.syncService.rejectedOp(state.opId)?.row : null
    const source = refused ? toRuleRow(refused) : stored
    if (!source) {
      this.state.set(null)
      return
    }
    this.startWalletId.set(null)
    this.form.reset(
      this.toForm({
        walletId: source.walletId,
        categoryId: source.categoryId ?? '',
        amount: source.amount,
        occurredOn: source.startOn,
        note: source.note,
        excludeFromReport: source.excludeFromReport,
      })
    )
    this.repeat.set({
      frequency: source.frequency,
      interval: source.interval,
      endOn: source.endOn,
      endCount: source.endCount,
      confirm: source.confirm,
    })
    this.more.set(true)
    this.keypad.open.set(false)
    if (refused) {
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    }
  }

  /**
   * The event a sheet starts with (event rule 5): the row's or the copied one's, the event page's
   * "เพิ่มรายการ"; undefined = a plain add, which the date decides.
   */
  private startEventId(state: TransactionSheetState): string | null | undefined {
    switch (state.mode) {
      case 'create':
        return (
          state.eventId ?? (this.transactionService.liveEventId(state.values?.eventId) || undefined)
        )
      case 'edit':
        return this.transactionService.liveEventId(this.transactionService.byId(state.id)?.eventId)
      case 'fix':
        return this.transactionService.liveEventId(state.values.eventId)
      default:
        return null
    }
  }

  /** The debt a sheet starts linked to (debt rule 3). */
  private startDebtId(state: TransactionSheetState): string | null {
    switch (state.mode) {
      case 'create':
        return state.values?.debtId ?? null
      case 'edit':
        return this.transactionService.byId(state.id)?.debtId ?? null
      case 'fix':
        return state.values.debtId ?? this.transactionService.byId(state.id)?.debtId ?? null
      default:
        return this.recurringService.byId(state.id)?.debtId ?? null
    }
  }

  private startValues(state: TransactionSheetState): TransactionValues | null {
    return state.mode === 'fix'
      ? state.values
      : state.mode === 'edit'
        ? this.transactionService.byId(state.id)
        : null
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** A wallet's minor unit, read from the control (the validator runs before `wallet()` updates). */
  private minorUnitOf(walletId: string): number {
    const wallet = walletId ? this.walletService.byId(walletId) : null
    return this.walletService.minorUnit(wallet?.currencyCode ?? '')
  }

  private dropUnfit(): void {
    // The controls, not `values()`: this runs in a control's own valueChanges, before the form's
    // (which feeds `values()`) has emitted, so `wallet()` would still be the previous one.
    const { categoryId, walletId, type } = this.form.getRawValue()
    const category = categoryId ? this.categoryService.byId(categoryId) : null
    const wallet = walletId ? this.walletService.byId(walletId) : null
    if (
      category &&
      (category.type !== type || isHiddenIn(wallet?.hiddenCategoryIds ?? [], category))
    ) {
      // Rule 2: an edit keeps an archived category, but not one that changed type or is hidden.
      this.form.controls.categoryId.setValue('')
    }
  }

  private toForm(values: TransactionValues) {
    const minorUnit = this.walletService.minorUnit(
      this.walletService.byId(values.walletId)?.currencyCode ?? ''
    )
    return {
      type: this.categoryService.byId(values.categoryId)?.type ?? 'expense',
      walletId: values.walletId,
      amount: amountText(values.amount, minorUnit),
      categoryId: values.categoryId,
      note: values.note,
      occurredOn: values.occurredOn,
      excludeFromReport: values.excludeFromReport,
    }
  }

  private describe(repeat: RepeatValues, startOn: string): string {
    return describeRepeat(repeat, startOn, this.t, this.languageService.locale())
  }

  private t = (key: string, params?: Record<string, unknown>) =>
    this.transloco.translate(key, params)
}
