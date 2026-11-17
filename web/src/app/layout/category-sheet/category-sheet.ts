import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArchive,
  lucideArchiveRestore,
  lucideCheck,
  lucideChevronRight,
  lucideFolderInput,
  lucideMerge,
  lucideTrash2,
  lucideTriangleAlert,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON, CATEGORY_LIMITS, CategoryService } from '@/core/category'
import type {
  Category,
  CategoryMergeMode,
  CategorySheetState,
  CategoryType,
  CategoryUnarchiveRefusal,
  CategoryValues,
} from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { WalletService } from '@/core/wallet'
import { CategoryMove } from '@/layout/category-move/category-move'
import {
  ColorField,
  FORM_IMPORTS,
  IconField,
  NameIconField,
  SegmentedField,
  ToggleListField,
  withMessage,
} from '@/shared/components/form'
import type { ToggleListItem } from '@/shared/components/form'
import {
  CATEGORY_ICON_GROUPS,
  IconBadge,
  USER_COLORS,
  userColor,
  WALLET_DEFAULT_ICON,
} from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import type { SelectOption } from '@/shared/types'
import type { CategoryFormGroup } from './category-form.type'

type View =
  'form' | 'icons' | 'parent' | 'wallets' | 'merge' | 'move' | 'confirmMerge' | 'confirmDelete'

const REFUSAL_KEYS: Record<CategoryUnarchiveRefusal, string> = {
  nameTaken: 'categories.unarchiveNameTaken',
  limit: 'categories.unarchiveLimit',
  parentArchived: 'categories.unarchiveParentArchived',
}

/**
 * The category form (docs/features/category.md → Web screens), a compact sheet (DESIGN.md §6):
 * icon + name, the type, the parent category (a picker view); the icon opens an icon-and-colour
 * view. Create, edit, "fix" a rejected op; in edit mode the header holds archive, merge (a
 * picker view, then a confirm view: rule 15) and delete (after a confirm view, only without
 * sub-categories or transactions). Opened through `CategoryService.open()`;
 * the shell loads it on first use.
 */
@Component({
  selector: 'app-category-sheet',
  imports: [
    FORM_IMPORTS,
    ReactiveFormsModule,
    TranslocoPipe,
    NgIcon,
    NameIconField,
    SegmentedField,
    ToggleListField,
    IconField,
    ColorField,
    IconBadge,
    HlmButton,
    HlmDrawerImports,
    SheetFrame,
    Slide,
    CategoryMove,
  ],
  providers: [
    provideIcons({
      lucideArchive,
      lucideArchiveRestore,
      lucideCheck,
      lucideChevronRight,
      lucideFolderInput,
      lucideMerge,
      lucideTrash2,
      lucideTriangleAlert,
    }),
  ],
  templateUrl: './category-sheet.html',
})
export class CategorySheet {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)
  protected categoryService = inject(CategoryService)
  private walletService = inject(WalletService)
  private bookService = inject(BookService)

  protected iconGroups = CATEGORY_ICON_GROUPS
  protected defaultIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected colors = USER_COLORS
  protected state = this.categoryService.sheet
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => {
    const view = this.view()
    return view === 'form' ? 0 : view === 'confirmMerge' ? 2 : 1
  })
  /** Why the category can't come back from the archive (a translation key). */
  protected refusal = signal<string | null>(null)

  /** The category being edited (edit and fix), null when creating. */
  protected editingId = computed(() => {
    const state = this.state()
    return state && state.mode !== 'create' ? state.id : null
  })
  /** The live category behind an edit (a refused create has none). */
  protected editing = computed(() => {
    const id = this.editingId()
    return id ? this.categoryService.byId(id) : null
  })
  protected editingName = computed(() => this.editing()?.name ?? '')
  /** Live sub-categories: the row keeps its type and parent, and can't be deleted (rules 3–6). */
  protected childCount = computed(() => {
    const id = this.editingId()
    return id ? this.categoryService.childrenOf(id).length : 0
  })
  /** Rules 4 and 6 (#8): with transactions it keeps its type and can only be archived. */
  protected used = computed(() => this.categoryService.hasTransactions(this.editingId()))
  protected usedCount = computed(() => this.categoryService.transactionCount(this.editingId()))
  protected treeColor = userColor

  /** Rule 15: where this category can merge into, the one picked, and what children do. */
  protected mergeTargets = computed(() => {
    const id = this.editing()?.id
    return id ? this.categoryService.mergeTargets(id) : []
  })
  protected mergeTargetId = signal<string | null>(null)
  protected mergeTarget = computed<Category | null>(() => {
    const id = this.mergeTargetId()
    return id ? this.categoryService.byId(id) : null
  })
  protected mergeMode = this.nnfb.control<string>('move')
  private mergeModeValue = toSignal(this.mergeMode.valueChanges, { initialValue: 'move' })
  protected mergeModeOptions = computed<SelectOption[]>(() => {
    this.languageService.language()
    return [
      { value: 'move', label: this.transloco.translate('categories.mergeModeMove') },
      { value: 'all', label: this.transloco.translate('categories.mergeModeAll') },
    ]
  })
  protected mergePlan = computed(() => {
    const source = this.editing()
    const target = this.mergeTargetId()
    return source && target
      ? this.categoryService.mergePlan(
          source.id,
          target,
          this.mergeModeValue() as CategoryMergeMode
        )
      : null
  })
  protected mergeParentName = computed(() => {
    const id = this.mergePlan()?.parentId
    return id ? (this.categoryService.byId(id)?.name ?? '') : ''
  })
  /** The book the name must be unique in (rule 2). */
  private bookId = computed(() => {
    const state = this.state()
    if (state?.mode === 'fix') {
      return this.editing()?.bookId ?? state.bookId
    }
    return this.editing()?.bookId ?? null
  })
  protected heading = computed(() => {
    switch (this.state()?.mode) {
      case 'edit':
        return 'categories.editHeading'
      case 'fix':
        return 'categories.fixHeading'
      default:
        return 'categories.createHeading'
    }
  })
  protected typeOptions = computed<SelectOption[]>(() => {
    this.languageService.language()
    return [
      { value: 'expense', label: this.transloco.translate('categories.expense') },
      { value: 'income', label: this.transloco.translate('categories.income') },
    ]
  })

  private formValue = signal<{ type: string; parentId: string; hiddenIn: readonly string[] }>({
    type: 'expense',
    parentId: '',
    hiddenIn: [],
  })
  /**
   * Rule 13, "ใช้ในกระเป๋า": the book's open wallets with a switch each; a wallet that hides
   * the chosen parent shows this one off, locked.
   */
  protected walletItems = computed<ToggleListItem[]>(() => {
    const bookId = this.bookId() ?? this.bookService.current()?.id
    if (!bookId) {
      return []
    }
    const parentId = this.formValue().parentId
    this.languageService.language()
    const note = this.transloco.translate('categories.hiddenWithParent')
    return this.walletService.openOf(bookId).map((wallet) => ({
      id: wallet.id,
      label: wallet.name,
      icon: wallet.icon,
      color: userColor(wallet.color),
      fallback: WALLET_DEFAULT_ICON,
      lockedNote: parentId && wallet.hiddenCategoryIds.includes(parentId) ? note : null,
    }))
  })
  protected usedIn = computed(() => {
    const items = this.walletItems()
    const off = this.formValue().hiddenIn
    return {
      used: items.filter((item) => !item.lockedNote && !off.includes(item.id)).length,
      total: items.length,
    }
  })
  /** The type's top-level open categories, without this one (rule 3). */
  protected parentOptions = computed(() =>
    this.categoryService.parents(this.formValue().type as CategoryType, this.editingId())
  )
  protected parentName = computed(() => {
    const id = this.formValue().parentId
    return id ? (this.categoryService.byId(id)?.name ?? null) : null
  })
  protected typeNote = computed(() => {
    if (this.childCount() > 0) {
      return 'categories.typeLocked'
    }
    if (this.used()) {
      return 'categories.typeUsed'
    }
    return this.formValue().parentId ? 'categories.typeFollowsParent' : null
  })

  // An archived category holds no name (rule 2); coming back is checked by `setArchived`.
  private nameFree: ValidatorFn = (control) => {
    const parent = control.parent?.getRawValue() as { type?: string; parentId?: string } | undefined
    return typeof control.value === 'string' &&
      this.editing()?.isArchived !== true &&
      this.categoryService.nameTaken(
        control.value,
        (parent?.type ?? 'expense') as CategoryType,
        parent?.parentId || null,
        this.editingId(),
        this.bookId() ?? undefined
      )
      ? { nameTaken: 'categories.nameTaken' }
      : null
  }

  form: CategoryFormGroup = this.nnfb.group({
    name: [
      '',
      [
        withMessage(Validators.required, 'categories.nameRequired'),
        withMessage(Validators.pattern(/\S/), 'categories.nameRequired'),
        Validators.maxLength(CATEGORY_LIMITS.NAME_MAX),
        this.nameFree,
      ],
    ],
    icon: [CATEGORY_DEFAULT_ICON as string],
    color: [USER_COLORS[0] as string],
    type: ['expense'],
    parentId: [''],
    hiddenIn: this.nnfb.control<string[]>([]),
  })

  protected open = signal(false)

  constructor() {
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.refusal.set(null)
      const { type, parentId, hiddenIn } = this.form.getRawValue()
      this.formValue.set({ type, parentId, hiddenIn })
    })
    // A parent belongs to one type: another type starts at the top level (rule 4).
    this.form.controls.type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      const parentId = this.form.controls.parentId.value
      if (parentId && this.categoryService.byId(parentId)?.type !== type) {
        this.form.controls.parentId.setValue('')
      }
      this.form.controls.name.updateValueAndValidity()
    })
    this.form.controls.parentId.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.syncTypeLock()
      this.form.controls.name.updateValueAndValidity()
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

  protected pickParent(id: string): void {
    this.form.controls.parentId.setValue(id)
    this.form.controls.parentId.markAsDirty()
    this.view.set('form')
  }

  protected pickMergeTarget(id: string): void {
    this.mergeTargetId.set(id)
    this.mergeMode.setValue('move')
    this.view.set('confirmMerge')
  }

  /** Rule 15: one write, no undo (the confirm view asked); unsaved edits go with the sheet. */
  protected merge(): void {
    const source = this.editing()
    const target = this.mergeTarget()
    if (!source || !target) {
      return
    }
    const mode = this.mergeMode.value as CategoryMergeMode
    if (this.categoryService.merge(source.id, target.id, mode)) {
      toast(this.transloco.translate('categories.merged', { from: source.name, to: target.name }))
      this.finish()
    }
  }

  protected save(): void {
    const state = this.state()
    if (!state || this.form.invalid || !this.categoryService.canWrite()) {
      return
    }
    const value = this.form.getRawValue()
    const values: CategoryValues = {
      name: value.name,
      icon: value.icon,
      color: value.color,
      type: value.type === 'income' ? 'income' : 'expense',
      parentId: value.parentId || null,
    }
    if (state.mode === 'fix') {
      this.categoryService.save(state.id, values, state.opId, state.bookId, value.hiddenIn)
    } else {
      this.categoryService.save(this.editingId(), values, null, undefined, value.hiddenIn)
    }
    toast.success(
      this.transloco.translate(state.mode === 'create' ? 'categories.created' : 'categories.saved')
    )
    this.finish()
  }

  /**
   * Rule 7: archive (or bring back) at once, with "undo" in the toast; coming back may be refused.
   * Unsaved edits keep the sheet open.
   */
  protected toggleArchive(): void {
    const category = this.editing()
    if (!category) {
      return
    }
    const archived = !category.isArchived
    const children = this.categoryService
      .childrenOf(category.id)
      .filter((child) => child.isArchived !== archived).length
    const refusal = this.categoryService.setArchived(category.id, archived)
    if (refusal) {
      this.refusal.set(REFUSAL_KEYS[refusal])
      return
    }
    const key = !archived
      ? 'categories.unarchived'
      : children > 0
        ? 'categories.archivedWithChildren'
        : 'categories.archived'
    toast(this.transloco.translate(key, { name: category.name, count: children }), {
      action: {
        label: this.transloco.translate('categories.undo'),
        onClick: () => {
          const undone = this.categoryService.setArchived(category.id, !archived)
          if (undone) {
            toast.error(this.transloco.translate(REFUSAL_KEYS[undone]))
          }
        },
      },
    })
    if (!this.form.dirty) {
      this.finish()
    }
  }

  protected remove(): void {
    const id = this.editingId()
    if (id) {
      const name = this.editingName()
      this.categoryService.remove(id)
      toast(this.transloco.translate('categories.deleted', { name }))
    }
    this.finish()
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.state.set(null)
  }

  /** A child's type is its parent's, and a parent with children keeps its type (rule 4). */
  private syncTypeLock(): void {
    const type = this.form.controls.type
    const parentId = this.form.controls.parentId.value
    const parent = parentId ? this.categoryService.byId(parentId) : null
    if (parent && type.value !== parent.type) {
      type.setValue(parent.type, { emitEvent: false })
    }
    // Recurring rule 15: a live rule on it fixes its type too.
    const locked =
      parent !== null ||
      this.childCount() > 0 ||
      this.used() ||
      this.categoryService.ruleCount(this.editingId()) > 0
    if (locked && type.enabled) {
      type.disable({ emitEvent: false })
    } else if (!locked && type.disabled) {
      type.enable({ emitEvent: false })
    }
  }

  private start(state: CategorySheetState): void {
    this.view.set('form')
    this.mergeTargetId.set(null)
    this.refusal.set(null)
    if (state.mode === 'create') {
      this.form.reset({
        name: '',
        icon: CATEGORY_DEFAULT_ICON,
        color: USER_COLORS[USER_COLORS.length - 1],
        type: state.type,
        parentId: state.parentId ?? '',
        hiddenIn: [],
      })
    } else if (state.mode === 'fix') {
      this.form.reset({
        ...this.toForm(state.values),
        hiddenIn: this.categoryService.hiddenIn(state.id, state.bookId),
      })
      this.form.markAllAsTouched()
      this.form.markAsDirty()
    } else {
      const category = this.categoryService.byId(state.id)
      if (!category) {
        this.state.set(null)
        return
      }
      this.form.reset({
        ...this.toForm(category),
        hiddenIn: this.categoryService.hiddenIn(category.id, category.bookId),
      })
    }
    const { type, parentId, hiddenIn } = this.form.getRawValue()
    this.formValue.set({ type, parentId, hiddenIn })
    this.syncTypeLock()
  }

  private toForm(values: CategoryValues) {
    return {
      name: values.name,
      icon: values.icon,
      color: userColor(values.color),
      type: values.type,
      parentId: values.parentId ?? '',
    }
  }
}
