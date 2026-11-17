import { Component, inject, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChartPie, lucideUser, lucideWifiOff } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { BookService } from '@/core/book'
import { EmptyState } from '@/shared/components/empty-state'

/**
 * A book shared with me, where its data can't show (sharing rule 10): offline (or the server
 * down), the whole book is blocked with a way back to an own book; Reports cover own
 * books only, like the pages about a book's own setup ("mine").
 */
@Component({
  selector: 'app-shared-book-step',
  imports: [TranslocoPipe, NgIcon, HlmButton, EmptyState],
  providers: [provideIcons({ lucideChartPie, lucideUser, lucideWifiOff })],
  templateUrl: './shared-book-step.html',
})
export class SharedBookStep {
  protected bookService = inject(BookService)

  reason = input.required<'offline' | 'reports' | 'mine'>()
}
