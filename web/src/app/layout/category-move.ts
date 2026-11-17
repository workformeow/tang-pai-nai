import { Component, computed, inject, input, output, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideArrowRight, lucideChevronRight, lucideEyeOff } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSwitch } from '@spartan-ng/helm/switch'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import type { Category, CategoryNode } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { OfflineService } from '@/core/offline'
import { IconBadge, userColor } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { moveCategoryRows, moveSources, undoCategoryMove } from './category-move-rows'

type Step = 'choose' | 'target' | 'confirm'

/**
 * "ย้ายรายการ" inside the category sheet (docs/features/export.md rules 7–10, mock-up frames
 * 6–7): from which wallet, to which category, hide the old one there, then confirm. One local
 * write; the toast's เลิกทำ puts it back.
 */
@Component({
  selector: 'app-category-move',
  imports: [TranslocoPipe, NgIcon, HlmButton, HlmSwitch, IconBadge, SheetFrame],
  providers: [provideIcons({ lucideArrowRight, lucideChevronRight, lucideEyeOff })],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './category-move.html',
})
export class CategoryMove {
  private transloco = inject(TranslocoService)
  private offlineService = inject(OfflineService)
  private languageService = inject(LanguageService)
  protected categoryService = inject(CategoryService)

  category = input.required<Category>()
  back = output()
  moved = output()

  protected defaultIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected treeColor = userColor
  protected step = signal<Step>('choose')
  protected walletId = signal<string | null>(null)
  protected targetId = signal<string | null>(null)
  protected hide = signal(false)

  protected sources = computed(() => {
    this.offlineService.changes()
    const id = this.category().id
    return this.offlineService.isOpen() ? moveSources(this.offlineService.db(), id) : []
  })
  protected total = computed(() => this.sources().reduce((sum, source) => sum + source.count, 0))
  protected count = computed(() => {
    const walletId = this.walletId()
    return walletId === null
      ? this.total()
      : (this.sources().find((source) => source.walletId === walletId)?.count ?? 0)
  })
  protected walletName = computed(
    () => this.sources().find((source) => source.walletId === this.walletId())?.walletName ?? ''
  )
  /** Rule 8: open categories of the same type and book, itself left out (its row is shown). */
  protected targets = computed<CategoryNode[]>(() => {
    const category = this.category()
    return this.categoryService
      .treeOf(category.bookId, category.type)
      .filter((node) => node.category.id !== category.id || node.children.length > 0)
      .map((node) => ({
        ...node,
        children: node.children.filter((child) => child.id !== category.id),
      }))
  })
  protected target = computed<Category | null>(() => {
    const id = this.targetId()
    return id ? this.categoryService.byId(id) : null
  })
  /** "อาหาร › เครื่องดื่ม" for a child, as the pickers show it. */
  protected targetName = computed(() => {
    const target = this.target()
    if (!target) {
      return ''
    }
    const parent = target.parentId ? this.categoryService.byId(target.parentId) : null
    return parent ? `${parent.name} › ${target.name}` : target.name
  })

  private numberFormat = computed(() => new Intl.NumberFormat(this.languageService.locale()))
  protected number(value: number): string {
    return this.numberFormat().format(value)
  }

  /** The `One` key when a single row moves (English counts, web/AGENTS.md → UI text). */
  protected one(key: string): string {
    return this.count() === 1 ? `${key}One` : key
  }

  protected pick(id: string): void {
    this.targetId.set(id)
    this.step.set('choose')
  }

  protected move(): void {
    const targetId = this.targetId()
    if (!targetId || !this.categoryService.canWrite()) {
      return
    }
    const fromId = this.category().id
    const walletId = this.walletId()
    const hide = walletId !== null && this.hide()
    const now = Date.now()
    const done = this.offlineService.write((db) =>
      moveCategoryRows(db, fromId, targetId, walletId, hide, now)
    )
    if (!done) {
      return
    }
    toast(
      this.transloco.translate(done.ids.length === 1 ? 'categories.movedOne' : 'categories.moved', {
        count: this.number(done.ids.length),
      }),
      {
        action: {
          label: this.transloco.translate('transactions.undo'),
          onClick: () => {
            this.offlineService.write((db) => {
              undoCategoryMove(db, done, Date.now())
            })
          },
        },
      }
    )
    this.moved.emit()
  }
}
