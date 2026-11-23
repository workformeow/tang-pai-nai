import { CdkDrag, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop'
import type { CdkDragDrop } from '@angular/cdk/drag-drop'
import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChevronDown,
  lucideChevronRight,
  lucideGripVertical,
  lucidePlus,
  lucideShapes,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { BookService } from '@/core/book'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import type { Category, CategoryType } from '@/core/category'
import { isHiddenIn, WalletService } from '@/core/wallet'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge, userColor } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'

/**
 * Account › หมวดหมู่ (docs/features/category.md → Web screens): the current book's categories
 * (the book shown on top opens the switch sheet), รายจ่าย / รายรับ tabs, parents with their
 * sub-categories, an order mode (rule 10) and the archived ones folded away.
 */
@Component({
  selector: 'app-categories-page',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    EmptyState,
    IconBadge,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
  ],
  providers: [
    provideIcons({
      lucideChevronDown,
      lucideChevronRight,
      lucideGripVertical,
      lucidePlus,
      lucideShapes,
    }),
  ],
  templateUrl: './categories-page.html',
})
export class CategoriesPage {
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  protected bookService = inject(BookService)
  protected categoryService = inject(CategoryService)
  private walletService = inject(WalletService)

  protected tabs: readonly CategoryType[] = ['expense', 'income']
  protected defaultIcon = CATEGORY_DEFAULT_ICON as UserIcon
  /** The parent's colour as drawn, for its children's panel. */
  protected treeColor = userColor
  protected type = signal<CategoryType>('expense')
  protected ordering = signal(false)
  protected showArchived = signal(false)

  protected tree = computed(() => this.categoryService.tree(this.type()))
  /**
   * The tab's open categories no open wallet uses (category rule 13): `own` when hidden in every
   * wallet, `parent` for a child of such a parent. Empty while the book has no open wallet.
   */
  protected disabled = computed(() => {
    const wallets = this.walletService.openWallets()
    const disabled = new Map<string, 'own' | 'parent'>()
    if (wallets.length === 0) {
      return disabled
    }
    const offEverywhere = (category: Category) =>
      wallets.every((wallet) => isHiddenIn(wallet.hiddenCategoryIds, category))
    for (const node of this.tree()) {
      const parentOff = offEverywhere(node.category)
      if (parentOff) {
        disabled.set(node.category.id, 'own')
      }
      for (const child of node.children) {
        if (parentOff) {
          disabled.set(child.id, 'parent')
        } else if (offEverywhere(child)) {
          disabled.set(child.id, 'own')
        }
      }
    }
    return disabled
  })
  /**
   * Archived parents, each followed by its archived children (indented), then archived children
   * of open parents (with "under <parent>").
   */
  protected archived = computed(() => {
    const type = this.type()
    return [
      ...this.categoryService
        .tree(type, true)
        .flatMap((node) => [
          { category: node.category, child: false },
          ...node.children.map((category) => ({ category, child: true })),
        ]),
      ...this.categoryService
        .archivedChildren(type)
        .map((category) => ({ category, child: false })),
    ]
  })

  /** Touch: press and hold the handle before dragging, so scrolling the list still works. */
  protected dragDelay = { touch: 300, mouse: 0 }

  constructor() {
    // "Fix" in the sync sheet opens this page with the rejected op's id.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const fix = params.get('fix')
      if (fix) {
        this.categoryService.openFix(fix)
        void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      }
    })
  }

  protected selectType(type: CategoryType): void {
    this.type.set(type)
  }

  protected parentName(category: Category): string | null {
    return category.parentId ? (this.categoryService.byId(category.parentId)?.name ?? null) : null
  }

  protected dropParent(event: CdkDragDrop<unknown>): void {
    const parent = this.tree().at(event.previousIndex)?.category
    if (parent) {
      this.categoryService.moveTo(parent.id, event.currentIndex)
    }
  }

  protected dropChild(parentId: string, event: CdkDragDrop<unknown>): void {
    const node = this.tree().find((item) => item.category.id === parentId)
    const child = node?.children.at(event.previousIndex)
    if (child) {
      this.categoryService.moveTo(child.id, event.currentIndex)
    }
  }

  /** The handle's keyboard way (DESIGN.md §8: a drag is never the only way). */
  protected moveBy(event: Event, category: Category, step: -1 | 1): void {
    event.preventDefault()
    // The row's place now among its siblings, not the rendered one.
    const siblings =
      category.parentId === null
        ? this.tree().map((node) => node.category)
        : (this.tree().find((node) => node.category.id === category.parentId)?.children ?? [])
    const index = siblings.findIndex((item) => item.id === category.id)
    this.categoryService.moveTo(category.id, index + step)
    const target = event.target
    queueMicrotask(() => target instanceof HTMLElement && target.focus())
  }
}
