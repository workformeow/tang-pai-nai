import { Component, computed, inject, input, output } from '@angular/core'
import type { OnInit } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck, lucideEyeOff } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import type { Category, CategoryNode, CategoryType } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { TransactionService } from '@/core/transaction'
import { isHiddenIn, WalletService } from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { SegmentedField } from '@/shared/components/form'
import { IconBadge, userColor } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import type { SelectOption } from '@/shared/types'

const TYPES: readonly CategoryType[] = ['expense', 'income']

/**
 * The transaction sheet's category view (transaction.md → Web screens): the type tabs, "ใช้บ่อย"
 * (8.2) and the book's tree of the tab's type, without what the wallet hides (category rule 13).
 * The form has no type control of its own (Money Lover style): picking a category sets the type,
 * so the tab only filters.
 */
@Component({
  selector: 'app-transaction-category-pick',
  imports: [TranslocoPipe, NgIcon, HlmButton, SegmentedField, IconBadge, SheetFrame],
  providers: [provideIcons({ lucideCheck, lucideEyeOff })],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './transaction-category-pick.html',
})
export class TransactionCategoryPick implements OnInit {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)
  protected bookService = inject(BookService)
  private categoryService = inject(CategoryService)
  private transactionService = inject(TransactionService)
  private walletService = inject(WalletService)

  bookId = input.required<string>()
  wallet = input<Wallet | null>(null)
  /** The form's type: the tab the view opens on. */
  type = input.required<string>()
  /** The form's category, ticked in the list. */
  chosen = input('')
  picked = output<string>()
  back = output()

  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected treeColor = userColor
  /** The tab: the form's type when the view opens, then the user's. */
  protected pickType = this.nnfb.control<string>('expense')
  protected pickTypeValue = toSignal(this.pickType.valueChanges, {
    initialValue: this.pickType.value,
  })

  protected typeOptions = computed<SelectOption[]>(() => {
    this.languageService.language()
    return TYPES.map((type) => ({
      value: type,
      label: this.transloco.translate(`categories.${type}`),
    }))
  })
  /** Category rule 13: the tab's open categories the wallet doesn't hide. */
  protected tree = computed<CategoryNode[]>(() => {
    const type = this.pickTypeValue() as CategoryType
    const hidden = this.wallet()?.hiddenCategoryIds ?? []
    return this.categoryService
      .treeOf(this.bookId(), type)
      .filter((node) => !isHiddenIn(hidden, node.category))
      .map((node) => ({
        category: node.category,
        children: node.children.filter((child) => !isHiddenIn(hidden, child)),
      }))
  })
  /** "ใช้บ่อย" (8.2): up to 4 of the most used categories the tree offers. */
  protected frequent = computed<Category[]>(() => {
    const offered = new Map<string, Category>()
    for (const node of this.tree()) {
      offered.set(node.category.id, node.category)
      for (const child of node.children) {
        offered.set(child.id, child)
      }
    }
    const type = this.pickTypeValue() as CategoryType
    return this.transactionService
      .frequentCategoryIds(this.bookId(), type)
      .flatMap((id) => offered.get(id) ?? [])
      .slice(0, 4)
  })

  ngOnInit(): void {
    this.pickType.setValue(this.type())
  }

  /** Category rule 13: the wallet's "หมวดหมู่ที่ใช้", over the transaction sheet. */
  protected openWalletCategories(): void {
    const wallet = this.wallet()
    if (wallet) {
      this.walletService.open({ mode: 'edit', id: wallet.id, view: 'categories' })
    }
  }
}
