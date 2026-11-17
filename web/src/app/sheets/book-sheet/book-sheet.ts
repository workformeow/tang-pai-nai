import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideTrash2 } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BOOK_LIMITS, BookService } from '@/core/book'
import type { BookSheetState } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import {
  ColorField,
  FORM_IMPORTS,
  IconField,
  NameIconField,
  withMessage,
} from '@/shared/components/form'
import { BOOK_ICON_NAMES, USER_COLORS, userColor } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import type { BookFormGroup } from './book-form.type'

type View = 'form' | 'icons' | 'confirmDelete'

/**
 * The book form (docs/features/book.md → Web screens), a compact sheet (DESIGN.md §6): icon +
 * name, the icon opening an icon-and-colour view. Create, edit, "fix" a rejected op, and delete
 * (header icon) after a confirm view. Opened from anywhere through `BookService.open()`; the
 * shell loads it on first use.
 */
@Component({
  selector: 'app-book-sheet',
  imports: [
    FORM_IMPORTS,
    TranslocoPipe,
    NgIcon,
    NameIconField,
    IconField,
    ColorField,
    HlmButton,
    HlmDrawerImports,
    SheetFrame,
    Slide,
  ],
  providers: [provideIcons({ lucideTrash2 })],
  templateUrl: './book-sheet.html',
})
export class BookSheet {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)
  protected bookService = inject(BookService)

  protected icons = BOOK_ICON_NAMES
  protected colors = USER_COLORS
  protected state = this.bookService.sheet
  protected view = signal<View>('form')
  /** How deep the view is: a deeper one slides in from the right, going back from the left. */
  protected depth = computed(() => (this.view() === 'form' ? 0 : 1))

  /** The book being edited (edit and fix), null when creating. */
  protected editingId = computed(() => {
    const state = this.state()
    return state && state.mode !== 'create' ? state.id : null
  })
  protected editingName = computed(() => {
    const id = this.editingId()
    return (id && this.bookService.byId(id)?.name) ?? ''
  })
  /**
   * Rule 8 (category rule 12, transaction rule 9): the confirm step says how many wallets,
   * categories and transactions go with the book.
   */
  protected deleteText = computed(() => {
    this.languageService.language()
    const id = this.editingId()
    const t = (key: string, params?: object) => this.transloco.translate(`books.${key}`, params)
    // [one, many] translation keys and how many go with the book.
    const counts: [string, string, number][] = [
      ['deleteWallet', 'deleteWallets', id ? this.bookService.walletCount(id) : 0],
      ['deleteCategory', 'deleteCategories', id ? this.bookService.categoryCount(id) : 0],
      ['deleteTransaction', 'deleteTransactions', id ? this.bookService.transactionCount(id) : 0],
      ['deleteRule', 'deleteRules', id ? this.bookService.ruleCount(id) : 0],
      ['deleteDebt', 'deleteDebts', id ? this.bookService.debtCount(id) : 0],
      ['deleteEvent', 'deleteEvents', id ? this.bookService.eventCount(id) : 0],
    ]
    const items = counts
      .filter(([, , count]) => count > 0)
      .map(([one, many, count]) => (count === 1 ? t(one) : t(many, { count })))
    if (items.length === 0) {
      return t('deleteText')
    }
    const list = new Intl.ListFormat(this.languageService.locale(), { type: 'conjunction' })
    return t('deleteTextWith', { items: list.format(items) })
  })
  protected heading = computed(() => {
    switch (this.state()?.mode) {
      case 'edit':
        return 'books.editHeading'
      case 'fix':
        return 'books.fixHeading'
      default:
        return 'books.createHeading'
    }
  })

  private nameFree: ValidatorFn = (control) =>
    typeof control.value === 'string' && this.bookService.nameTaken(control.value, this.editingId())
      ? { nameTaken: 'books.nameTaken' }
      : null

  form: BookFormGroup = this.nnfb.group({
    name: [
      '',
      [
        withMessage(Validators.required, 'books.nameRequired'),
        withMessage(Validators.pattern(/\S/), 'books.nameRequired'),
        Validators.maxLength(BOOK_LIMITS.NAME_MAX),
        this.nameFree,
      ],
    ],
    icon: [BOOK_ICON_NAMES[0] as string],
    color: [USER_COLORS[0] as string],
  })

  protected open = signal(false)

  constructor() {
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

  protected save(): void {
    const state = this.state()
    if (!state || this.form.invalid || !this.bookService.canWrite()) {
      return
    }
    const value = this.form.getRawValue()
    const fixOpId = state.mode === 'fix' ? state.opId : null
    this.bookService.save(
      this.editingId(),
      { name: value.name, icon: value.icon, color: value.color },
      fixOpId
    )
    toast.success(
      this.transloco.translate(state.mode === 'create' ? 'books.created' : 'books.saved')
    )
    this.finish()
  }

  protected remove(): void {
    const id = this.editingId()
    if (id) {
      // Read before the delete: the book is gone from the list right after.
      const name = this.editingName()
      this.bookService.remove(id)
      toast(this.transloco.translate('books.deleted', { name }))
    }
    this.finish()
  }

  /** Saved, deleted, ✕, a swipe down, the backdrop or Escape: unsaved input goes (DESIGN.md §6). */
  protected finish(): void {
    this.form.markAsPristine()
    this.state.set(null)
  }

  private start(state: BookSheetState): void {
    this.view.set('form')
    if (state.mode === 'create') {
      this.form.reset({ name: '', icon: BOOK_ICON_NAMES[0], color: USER_COLORS[0] })
      return
    }
    if (state.mode === 'fix') {
      this.form.reset(state.values)
      this.form.markAllAsTouched()
      this.form.markAsDirty()
      return
    }
    const book = this.bookService.byId(state.id)
    if (!book) {
      this.state.set(null)
      return
    }
    this.form.reset({ name: book.name, icon: book.icon, color: userColor(book.color) })
  }
}
