import { Component, computed, inject, input, model } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideCheck,
  lucidePlus,
  lucideSettings2,
  lucideUsers,
  lucideWifiOff,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import type { SharingService, ShareGroup } from '@/core/sharing'
import { IconBadge } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'

/**
 * The switcher's sheet: books in order, add (footer), manage (header icon); book.md. Then
 * "แชร์กับฉัน": books shared with me, online only (sharing rule 10).
 */
@Component({
  selector: 'app-book-switch-sheet',
  imports: [TranslocoPipe, RouterLink, NgIcon, HlmButton, HlmDrawerImports, IconBadge, SheetFrame],
  providers: [
    provideIcons({ lucideCheck, lucidePlus, lucideSettings2, lucideUsers, lucideWifiOff }),
  ],
  templateUrl: './book-switch-sheet.html',
})
export class BookSwitchSheet {
  protected bookService = inject(BookService)

  open = model(false)
  /** Loaded by the shell after its first render (null until then). */
  sharing = input<SharingService | null>(null)

  protected groups = computed(() => this.sharing()?.withMe()?.shares ?? [])
  protected canCall = computed(() => this.sharing()?.canCall() ?? false)

  protected pickShared(group: ShareGroup): void {
    this.open.set(false)
    void this.sharing()?.openShared(group)
  }

  protected pick(id: string): void {
    this.bookService.select(id)
    this.open.set(false)
  }

  /** "เพิ่มสมุด" adds an own book: what an own one could write. */
  protected ownCanWrite = computed(() => this.bookService.isShared() || this.bookService.canWrite())

  protected add(): void {
    this.bookService.leaveShared()
    this.open.set(false)
    this.bookService.open({ mode: 'create' })
  }
}
