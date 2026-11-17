import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArchive,
  lucideArchiveRestore,
  lucideChevronRight,
  lucideTrash2,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import type { CategoryType } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { WALLET_LIMITS, WalletService } from '@/core/wallet'
import type { UnarchiveRefusal, WalletSheetState, WalletValues } from '@/core/wallet'
import { CurrencyPick } from '@/layout/currency-pick/currency-pick'
import { CurrencyFlag } from '@/shared/components/currency-flag'
import {
  AmountField,
  ColorField,
  FORM_IMPORTS,
  IconField,
  NameIconField,
  SwitchField,
  ToggleListField,
  withMessage,
} from '@/shared/components/form'
import type { ToggleListItem } from '@/shared/components/form'
import {
  USER_COLORS,
  userColor,
  WALLET_DEFAULT_ICON,
  WALLET_ICON_GROUPS,
} from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import { parseMajor, toMajorText } from '@/shared/utils'
import type { WalletFormGroup } from './wallet-form.type'

type View = 'form' | 'icons' | 'currency' | 'categories' | 'confirmDelete'

const CATEGORY_TABS: readonly CategoryType[] = ['expense', 'income']

const REFUSAL_KEYS: Record<UnarchiveRefusal, string> = {
  nameTaken: 'wallets.unarchiveNameTaken',
  limit: 'wallets.unarchiveLimit',
}

/**
 * The wallet form (docs/features/wallet.md → Web screens), a compact sheet (DESIGN.md §6): icon +
 * name, starting balance + currency, "exclude from total"; the icon opens an icon-and-colour view.
 * Create, edit, "fix" a rejected op; in edit mode the header holds archive and delete (after a
 * confirm view). Opened from anywhere through `WalletService.open()`; the shell loads it on first
 * use.
 */
@Component({
  selector: 'app-wallet-sheet',
  imports: [
    FORM_IMPORTS,
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    NameIconField,
    AmountField,
    SwitchField,
    ToggleListField,
    IconField,
    ColorField,
    CurrencyFlag,
    CurrencyPick,
    HlmButton,
    HlmDrawerImports,
    SheetFrame,
    Slide,
  ],
  providers: [
    provideIcons({ lucideArchive, lucideArchiveRestore, lucideChevronRight, lucideTrash2 }),
  ],
  templateUrl: './wallet-sheet.html',
})
export class WalletSheet {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)
  protected walletService = inject(WalletService)
  private categoryService = inject(CategoryService)
  private bookService = inject(BookService)

  protected iconGroups = WALLET_ICON_GROUPS
  protected defaultIcon = WALLET_DEFAULT_ICON
  protected colors = USER_COLORS
  protected state = this.walletService.sheet
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => (this.view() === 'form' ? 0 : 1))
  protected categoryTabs = CATEGORY_TABS
  protected categoryTab = signal<CategoryType>('expense')
  /** Why the wallet can't come back from the archive (a translation key). */
  protected refusal = signal<string | null>(null)

  /** The wallet being edited (edit and fix), null when creating. */
  protected editingId = computed(() => {
    const state = this.state()
    return state && state.mode !== 'create' ? state.id : null
  })
  /** The live wallet behind an edit (a refused create has none). */
  protected editing = computed(() => {
    const id = this.editingId()
    return id ? this.walletService.byId(id) : null
  })
  protected editingName = computed(() => this.editing()?.name ?? '')
  /** The book the name must be unique in (wallet rule 3). */
  private bookId = computed(() => {
    const state = this.state()
    if (state?.mode === 'fix') {
      return this.editing()?.bookId ?? state.bookId
    }
    return this.editing()?.bookId ?? null
  })
  /** The book whose categories the wallet picks from (category rule 13). */
  private categoryBookId = computed(() => this.bookId() ?? this.bookService.current()?.id ?? null)
  /** The ids switched off in the categories view (signal copy of the control). */
  private hidden = signal<readonly string[]>([])
  /** "ซ่อน n": the book's open categories hidden here, children of a hidden parent too. */
  protected hiddenCount = computed(() => {
    const bookId = this.categoryBookId()
    const hidden = this.hidden()
    if (!bookId || hidden.length === 0) {
      return 0
    }
    return CATEGORY_TABS.flatMap((type) => this.categoryService.treeOf(bookId, type)).flatMap(
      (node) =>
        hidden.includes(node.category.id)
          ? [node.category, ...node.children]
          : node.children.filter((child) => hidden.includes(child.id))
    ).length
  })
  protected categoryItems = computed<ToggleListItem[]>(() => {
    const bookId = this.categoryBookId()
    if (!bookId) {
      return []
    }
    const hidden = this.hidden()
    const note = this.transloco.translate('categories.hiddenWithParent')
    this.languageService.language()
    return this.categoryService
      .treeOf(bookId, this.categoryTab())
      .flatMap((node) => [
        this.categoryItem(node.category, false, null),
        ...node.children.map((child) =>
          this.categoryItem(child, true, hidden.includes(node.category.id) ? note : null)
        ),
      ])
  })
  protected heading = computed(() => {
    switch (this.state()?.mode) {
      case 'edit':
        return 'wallets.editHeading'
      case 'fix':
        return 'wallets.fixHeading'
      default:
        return 'wallets.createHeading'
    }
  })
  /** Rule 4: shown read-only once the wallet has transactions (#8). */
  protected currencyLocked = computed(
    () => !this.walletService.canChangeCurrency(this.editing()?.id ?? null)
  )
  /** The form's currency as a signal (the chip's label reads it). */
  private currencyCode = signal('')
  /** The chip's full name, for its label. */
  protected currencyName = computed(() => {
    const code = this.currencyCode()
    return code
      ? (new Intl.DisplayNames(this.languageService.locale(), { type: 'currency' }).of(code) ??
          code)
      : ''
  })

  // An archived wallet holds no name (rule 3); coming back is checked by `setArchived`.
  private nameFree: ValidatorFn = (control) =>
    typeof control.value === 'string' &&
    this.editing()?.isArchived !== true &&
    this.walletService.nameTaken(control.value, this.editingId(), this.bookId() ?? undefined)
      ? { nameTaken: 'wallets.nameTaken' }
      : null

  /** Rule 5: major-unit text in the currency's digits, within ±10¹⁵ minor units. */
  private balanceValid: ValidatorFn = (control) => {
    if (typeof control.value !== 'string') {
      return null
    }
    // The form isn't built yet on the first run; the currency then is still empty.
    const currency: unknown = control.parent?.get('currencyCode')?.value
    const parsed = parseMajor(
      control.value,
      this.walletService.minorUnit(typeof currency === 'string' ? currency : '')
    )
    if (!parsed.ok) {
      return parsed.error === 'decimals'
        ? { balanceDecimals: 'wallets.balanceDecimals' }
        : { balanceFormat: 'wallets.balanceFormat' }
    }
    return parsed.minor > WALLET_LIMITS.BALANCE_MAX
      ? { balanceTooBig: 'wallets.balanceTooBig' }
      : null
  }

  form: WalletFormGroup = this.nnfb.group({
    name: [
      '',
      [
        withMessage(Validators.required, 'wallets.nameRequired'),
        withMessage(Validators.pattern(/\S/), 'wallets.nameRequired'),
        Validators.maxLength(WALLET_LIMITS.NAME_MAX),
        this.nameFree,
      ],
    ],
    initialBalance: ['', [this.balanceValid]],
    negative: [false],
    currencyCode: [''],
    isCreditCard: [false],
    excludeFromTotal: [false],
    icon: [WALLET_DEFAULT_ICON as string],
    color: [USER_COLORS[0] as string],
    hiddenCategoryIds: this.nnfb.control<string[]>([]),
  })

  protected open = signal(false)
  /** The credit-card switch, for the template's hint (credit-card rule 1). */
  protected isCard = signal(false)

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.refusal.set(null)
      this.hidden.set(this.form.controls.hiddenCategoryIds.value)
    })
    // Credit-card rule 1: a card is out of the total, so that switch is on and locked.
    this.form.controls.isCreditCard.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((card) => this.lockExcluded(card))
    // The balance's allowed decimals follow the currency.
    this.form.controls.currencyCode.valueChanges.pipe(takeUntilDestroyed()).subscribe((code) => {
      this.currencyCode.set(code)
      this.form.controls.initialBalance.updateValueAndValidity()
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

  /** The "สกุลเงิน" view's pick: back to the form at once (currency.md → Web screens). */
  protected pickCurrency(code: string): void {
    this.form.controls.currencyCode.setValue(code)
    this.form.controls.currencyCode.markAsDirty()
    this.view.set('form')
  }

  protected save(): void {
    const state = this.state()
    if (!state || this.form.invalid || !this.walletService.canWrite()) {
      return
    }
    const value = this.form.getRawValue()
    const parsed = parseMajor(value.initialBalance, this.minorUnit())
    const magnitude = parsed.ok ? parsed.minor : 0
    const values: WalletValues = {
      name: value.name,
      icon: value.icon,
      color: value.color,
      currencyCode: value.currencyCode,
      initialBalance: value.negative && magnitude !== 0 ? -magnitude : magnitude,
      excludeFromTotal: value.excludeFromTotal,
      isCreditCard: value.isCreditCard,
      hiddenCategoryIds: value.hiddenCategoryIds,
    }
    if (state.mode === 'fix') {
      this.walletService.save(state.id, values, state.opId, state.bookId)
    } else {
      this.walletService.save(this.editingId(), values)
    }
    toast.success(
      this.transloco.translate(state.mode === 'create' ? 'wallets.created' : 'wallets.saved')
    )
    this.finish()
  }

  /**
   * Rule 6: archive (or bring back) at once, with "undo" in the toast; coming back may be refused
   * (rule 3). Unsaved edits keep the sheet open.
   */
  protected toggleArchive(): void {
    const wallet = this.editing()
    if (!wallet) {
      return
    }
    const archived = !wallet.isArchived
    const refusal = this.walletService.setArchived(wallet.id, archived)
    if (refusal) {
      this.refusal.set(REFUSAL_KEYS[refusal])
      return
    }
    toast(
      this.transloco.translate(archived ? 'wallets.archived' : 'wallets.unarchived', {
        name: wallet.name,
      }),
      {
        action: {
          label: this.transloco.translate('wallets.undo'),
          onClick: () => {
            const undone = this.walletService.setArchived(wallet.id, !archived)
            if (undone) {
              toast.error(this.transloco.translate(REFUSAL_KEYS[undone]))
            }
          },
        },
      }
    )
    if (!this.form.dirty) {
      this.finish()
    }
  }

  protected remove(): void {
    const id = this.editingId()
    if (id) {
      const name = this.editingName()
      this.walletService.remove(id)
      toast(this.transloco.translate('wallets.deleted', { name }))
    }
    this.finish()
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.state.set(null)
  }

  private categoryItem(
    category: { id: string; name: string; icon: string; color: string },
    child: boolean,
    lockedNote: string | null
  ): ToggleListItem {
    return {
      id: category.id,
      label: category.name,
      icon: category.icon,
      color: userColor(category.color),
      fallback: CATEGORY_DEFAULT_ICON,
      child,
      lockedNote,
    }
  }

  private lockExcluded(card: boolean): void {
    this.isCard.set(card)
    const excluded = this.form.controls.excludeFromTotal
    if (card) {
      excluded.setValue(true, { emitEvent: false })
      excluded.disable({ emitEvent: false })
    } else {
      // Rule 8: turning the card off leaves the switch on, for the user to change.
      excluded.enable({ emitEvent: false })
    }
  }

  private minorUnit(): number {
    return this.walletService.minorUnit(this.form.controls.currencyCode.value)
  }

  private start(state: WalletSheetState): void {
    this.view.set('form')
    this.categoryTab.set('expense')
    this.refusal.set(null)
    if (state.mode === 'create') {
      this.form.reset({
        name: '',
        initialBalance: '',
        negative: false,
        currencyCode: this.walletService.defaultCurrency(),
        isCreditCard: false,
        excludeFromTotal: false,
        icon: WALLET_DEFAULT_ICON,
        color: USER_COLORS[0],
        hiddenCategoryIds: [],
      })
      return
    }
    if (state.mode === 'fix') {
      this.form.reset(this.toForm(state.values))
      this.form.markAllAsTouched()
      this.form.markAsDirty()
      return
    }
    const wallet = this.walletService.byId(state.id)
    if (!wallet) {
      this.state.set(null)
      return
    }
    this.form.reset(this.toForm(wallet))
    if (state.view === 'categories') {
      this.view.set('categories')
    }
  }

  private toForm(values: WalletValues) {
    const minorUnit = this.walletService.minorUnit(values.currencyCode)
    return {
      name: values.name,
      initialBalance:
        values.initialBalance === 0 ? '' : toMajorText(values.initialBalance, minorUnit),
      negative: values.initialBalance < 0,
      currencyCode: values.currencyCode,
      isCreditCard: values.isCreditCard,
      excludeFromTotal: values.excludeFromTotal,
      icon: values.icon,
      color: userColor(values.color),
      hiddenCategoryIds: values.hiddenCategoryIds,
    }
  }
}
