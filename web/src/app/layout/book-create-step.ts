import { Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideUsers } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { BookService } from '@/core/book'
import { EmptyState } from '@/shared/components/empty-state'

/** Book rule 5: no book yet, so the data tabs ask for the first one. */
@Component({
  selector: 'app-book-create-step',
  imports: [TranslocoPipe, NgIcon, HlmButton, EmptyState],
  providers: [provideIcons({ lucideUsers })],
  template: `
    <div class="flex flex-col items-center gap-3 p-4">
      <app-empty-state
        [heading]="'books.firstHeading' | transloco"
        [description]="'books.firstText' | transloco"
      >
        <ng-icon name="lucideUsers" />
      </app-empty-state>
      @if (!bookService.canWrite()) {
        <p class="w-full rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{
            (bookService.serverDown() ? 'sync.serverDownWrite' : 'books.needsOnline') | transloco
          }}
        </p>
      }
      <button
        hlmBtn
        type="button"
        class="-mt-8 h-11 px-6 text-base"
        [disabled]="!bookService.canWrite()"
        (click)="bookService.open({ mode: 'create' })"
      >
        {{ 'books.create' | transloco }}
      </button>
    </div>
  `,
})
export class BookCreateStep {
  protected bookService = inject(BookService)
}
