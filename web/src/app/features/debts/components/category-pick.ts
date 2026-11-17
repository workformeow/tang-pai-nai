import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject, input, output } from '@angular/core'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck } from '@ng-icons/lucide'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import type { Category, CategoryType } from '@/core/category'
import { IconBadge } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'

/**
 * A sheet view listing a book's open categories of one type, children in their parent's
 * tinted panel (DESIGN.md §6 Category tree): the instalments', interest's or forgiven rest's.
 */
@Component({
  selector: 'app-debt-category-pick',
  imports: [NgTemplateOutlet, NgIcon, IconBadge],
  providers: [provideIcons({ lucideCheck })],
  templateUrl: './category-pick.html',
})
export class DebtCategoryPick {
  private categoryService = inject(CategoryService)
  protected icon = CATEGORY_DEFAULT_ICON as UserIcon

  bookId = input.required<string>()
  type = input.required<CategoryType>()
  chosen = input<string | null>(null)
  picked = output<string>()

  protected tree = computed(() =>
    this.categoryService
      .treeOf(this.bookId(), this.type())
      .filter((node) => !node.category.isArchived)
      .map((node) => ({
        category: node.category,
        children: node.children.filter((child: Category) => !child.isArchived),
      }))
  )
}
