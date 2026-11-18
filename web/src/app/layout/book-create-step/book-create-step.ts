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
  templateUrl: './book-create-step.html',
})
export class BookCreateStep {
  protected bookService = inject(BookService)
}
