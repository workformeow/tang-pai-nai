import { Component, computed, inject, input, output, signal } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder } from '@angular/forms'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck, lucideChevronRight, lucideTriangleAlert } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { CATEGORY_DEFAULT_ICON, CategoryService } from '@/core/category'
import type { Category, CategoryMergeMode } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { SegmentedField } from '@/shared/components/form'
import { IconBadge, userColor } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { Slide } from '@/shared/components/slide'
import type { SelectOption } from '@/shared/types'

type Step = 'pick' | 'confirm'

/**
 * "รวมหมวด" inside the category sheet (docs/features/category.md rule 15): pick the category to
 * merge into, then a confirm view that says what moves where (and, for a parent, what its
 * children do). One write, no undo: the confirm view asked.
 */
@Component({
  selector: 'app-category-merge',
  imports: [TranslocoPipe, NgIcon, HlmButton, SegmentedField, IconBadge, SheetFrame, Slide],
  providers: [provideIcons({ lucideCheck, lucideChevronRight, lucideTriangleAlert })],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './category-merge.html',
})
export class CategoryMerge {
  private nnfb = inject(NonNullableFormBuilder)
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)
  protected categoryService = inject(CategoryService)

  /** The category that merges away. */
  category = input.required<Category>()
  /** The sheet's icon and colour, saved or not, for the confirm view's "this → that". */
  icon = input.required<string>()
  color = input.required<string>()
  back = output()
  merged = output()

  protected defaultIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected treeColor = userColor
  protected step = signal<Step>('pick')

  /** Rule 15: any category of the book it can merge into. */
  protected targets = computed(() => this.categoryService.mergeTargets(this.category().id))
  protected targetId = signal<string | null>(null)
  protected target = computed<Category | null>(() => {
    const id = this.targetId()
    return id ? this.categoryService.byId(id) : null
  })
  protected childCount = computed(() => this.categoryService.childrenOf(this.category().id).length)

  /** What a parent's children do: move under the target, or merge in with it. */
  protected mode = this.nnfb.control<string>('move')
  private modeValue = toSignal(this.mode.valueChanges, { initialValue: 'move' })
  protected modeOptions = computed<SelectOption[]>(() => {
    this.languageService.language()
    return [
      { value: 'move', label: this.transloco.translate('categories.mergeModeMove') },
      { value: 'all', label: this.transloco.translate('categories.mergeModeAll') },
    ]
  })
  /** What the merge will do, for the confirm view's lines. */
  protected plan = computed(() => {
    const target = this.targetId()
    return target
      ? this.categoryService.mergePlan(
          this.category().id,
          target,
          this.modeValue() as CategoryMergeMode
        )
      : null
  })
  protected planParentName = computed(() => {
    const id = this.plan()?.parentId
    return id ? (this.categoryService.byId(id)?.name ?? '') : ''
  })

  protected pick(id: string): void {
    this.targetId.set(id)
    this.mode.setValue('move')
    this.step.set('confirm')
  }

  protected merge(): void {
    const source = this.category()
    const target = this.target()
    if (!target) {
      return
    }
    const mode = this.mode.value as CategoryMergeMode
    if (this.categoryService.merge(source.id, target.id, mode)) {
      toast(this.transloco.translate('categories.merged', { from: source.name, to: target.name }))
      this.merged.emit()
    }
  }
}
