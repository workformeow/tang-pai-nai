import { CdkDrag, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop'
import type { CdkDragDrop } from '@angular/cdk/drag-drop'
import { Component, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronRight, lucideGripVertical, lucidePlus, lucideUsers } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { BookService } from '@/core/book'
import type { Book } from '@/core/book'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge } from '@/shared/components/icon-badge'

/**
 * Account › สมุด (docs/features/book.md → Web screens): the list in order, edit (in the
 * book sheet, which also deletes), and an order mode with up / down buttons.
 */
@Component({
  selector: 'app-books-page',
  imports: [
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
  providers: [provideIcons({ lucideChevronRight, lucideGripVertical, lucidePlus, lucideUsers })],
  templateUrl: './books-page.html',
})
export class BooksPage {
  private route = inject(ActivatedRoute)
  private router = inject(Router)
  protected bookService = inject(BookService)

  protected ordering = signal(false)

  constructor() {
    // "Fix" in the sync sheet opens this page with the rejected op's id.
    this.route.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const fix = params.get('fix')
      if (fix) {
        this.bookService.openFix(fix)
        void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      }
    })
  }

  /** Touch: press and hold the handle before dragging, so scrolling the list still works. */
  protected dragDelay = { touch: 300, mouse: 0 }

  protected drop(event: CdkDragDrop<unknown>): void {
    const book = this.bookService.books().at(event.previousIndex)
    if (book) {
      this.bookService.moveTo(book.id, event.currentIndex)
    }
  }

  /** The handle's keyboard way (DESIGN.md §8: a drag is never the only way). */
  protected moveBy(event: Event, id: string, step: -1 | 1): void {
    event.preventDefault()
    // The row's place now, not the rendered one: a second press may come before the re-render.
    const index = this.bookService.books().findIndex((item) => item.id === id)
    this.bookService.moveTo(id, index + step)
    const target = event.target
    // The row re-renders in its new place; keep the focus on its handle.
    queueMicrotask(() => target instanceof HTMLElement && target.focus())
  }

  protected edit(book: Book): void {
    this.bookService.open({ mode: 'edit', id: book.id })
  }
}
