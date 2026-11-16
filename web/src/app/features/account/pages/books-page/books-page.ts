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
  template: `
    @let books = bookService.books();
    <div class="flex flex-col gap-6 p-4">
      @if (!bookService.canWrite()) {
        <p class="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{
            (bookService.serverDown() ? 'sync.serverDownWrite' : 'books.needsOnline') | transloco
          }}
        </p>
      }
      @if (books.length === 0) {
        <app-empty-state
          [heading]="'books.firstHeading' | transloco"
          [description]="'books.firstText' | transloco"
        >
          <ng-icon name="lucideUsers" />
        </app-empty-state>
      } @else {
        <section class="flex flex-col gap-3" aria-labelledby="books-heading">
          <div class="flex items-center justify-between gap-3">
            <h2 id="books-heading" class="text-sm font-medium text-muted-foreground">
              {{ 'books.listHeading' | transloco: { count: books.length } }}
            </h2>
            @if (books.length > 1) {
              <button
                hlmBtn
                variant="ghost"
                type="button"
                class="-mr-2 h-11"
                [attr.aria-pressed]="ordering()"
                [disabled]="!bookService.canWrite()"
                (click)="ordering.set(!ordering())"
              >
                {{ (ordering() ? 'books.orderDone' : 'books.order') | transloco }}
              </button>
            }
          </div>
          <ul
            class="divide-y divide-border rounded-xl border border-border bg-card text-card-foreground"
            cdkDropList
            cdkDropListLockAxis="y"
            [cdkDropListDisabled]="!ordering()"
            (cdkDropListDropped)="drop($event)"
          >
            @for (book of books; track book.id) {
              <li
                class="flex min-h-14 items-center gap-3 bg-card py-2 pr-2 pl-4 first:rounded-t-xl last:rounded-b-xl"
                cdkDrag
                [cdkDragStartDelay]="dragDelay"
                cdkDragPreviewClass="tpn-drag-preview"
              >
                <div
                  *cdkDragPlaceholder
                  class="min-h-14 border-2 border-dashed border-border bg-muted"
                ></div>
                @if (ordering()) {
                  <app-icon-badge [icon]="book.icon" [color]="book.color" />
                  <span class="min-w-0 flex-1 truncate text-base">{{ book.name }}</span>
                  <button
                    hlmBtn
                    variant="ghost"
                    size="icon"
                    type="button"
                    class="size-11 touch-none"
                    cdkDragHandle
                    [attr.aria-label]="'books.dragItem' | transloco: { name: book.name }"
                    (keydown.arrowup)="moveBy($event, book.id, -1)"
                    (keydown.arrowdown)="moveBy($event, book.id, 1)"
                  >
                    <ng-icon name="lucideGripVertical" size="20" aria-hidden="true" />
                  </button>
                } @else {
                  <button
                    type="button"
                    class="-my-2 -mr-2 -ml-4 flex min-h-14 min-w-0 flex-1 items-center gap-3 py-2 pr-2 pl-4 text-left focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    [attr.aria-label]="'books.editItem' | transloco: { name: book.name }"
                    (click)="edit(book)"
                  >
                    <app-icon-badge [icon]="book.icon" [color]="book.color" />
                    <span class="flex min-w-0 flex-1 flex-col">
                      <span class="truncate text-base">{{ book.name }}</span>
                      @if (book.id === bookService.current()?.id) {
                        <span class="text-sm text-muted-foreground">
                          {{ 'books.currentHere' | transloco }}
                        </span>
                      }
                      @if (bookService.pendingIds().has(book.id)) {
                        <span class="text-sm text-muted-foreground">
                          {{ 'books.pending' | transloco }}
                        </span>
                      }
                    </span>
                    <ng-icon
                      name="lucideChevronRight"
                      size="20"
                      class="text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                }
              </li>
            }
          </ul>
          @if (ordering()) {
            <p class="text-sm text-muted-foreground">{{ 'books.orderHint' | transloco }}</p>
          }
        </section>
      }
      @if (!bookService.atLimit()) {
        <button
          hlmBtn
          [variant]="books.length === 0 ? 'default' : 'outline'"
          type="button"
          class="h-11 w-full"
          [disabled]="!bookService.canWrite()"
          (click)="bookService.open({ mode: 'create' })"
        >
          <ng-icon name="lucidePlus" size="20" aria-hidden="true" />
          {{ 'books.add' | transloco }}
        </button>
      } @else {
        <p class="text-sm text-muted-foreground">{{ 'books.limit' | transloco }}</p>
      }
    </div>
  `,
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
