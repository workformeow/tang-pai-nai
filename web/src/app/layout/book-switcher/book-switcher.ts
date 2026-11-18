import { Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronDown, lucideUsers } from '@ng-icons/lucide'
import { BookService } from '@/core/book'
import { IconBadge } from '@/shared/components/icon-badge'

/**
 * The current book at the left of every data tab's header (owner, 2026-11): one glass
 * capsule with the book's icon and a ▾, the same on every tab, like the wallet switcher
 * beside it. The name lives in the switch sheet it opens (`BookService.switchSheet`, rendered
 * by the shell); a book shared with me wears a small people badge (sharing rule 10).
 */
@Component({
  selector: 'app-book-switcher',
  imports: [TranslocoPipe, NgIcon, IconBadge],
  providers: [provideIcons({ lucideChevronDown, lucideUsers })],
  host: { class: 'flex min-w-0' },
  templateUrl: './book-switcher.html',
})
export class BookSwitcher {
  protected bookService = inject(BookService)
}
