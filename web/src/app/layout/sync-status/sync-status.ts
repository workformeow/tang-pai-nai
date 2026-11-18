import { Component, computed, inject, signal } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideCloud,
  lucideCloudAlert,
  lucideCloudCheck,
  lucideCloudOff,
  lucideRefreshCw,
} from '@ng-icons/lucide'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { SyncService } from '@/core/offline'
import type { SyncStatus as Status } from '@/core/offline'
import { SyncSheet } from '@/sheets/sync-sheet/sync-sheet'

/**
 * The header's sync status on every tab (offline-sync → Web screens; DESIGN.md §6 Status): a 44px
 * icon whose shape and colour say the state, with a count of waiting ops (owner's choice in #8 for
 * the Transactions tab, every tab since #9); the words stay in its label, announced politely, and
 * in the sync sheet it opens.
 */
@Component({
  selector: 'app-sync-status',
  imports: [TranslocoPipe, NgIcon, SyncSheet],
  providers: [
    provideIcons({
      lucideCloud,
      lucideCloudAlert,
      lucideCloudCheck,
      lucideCloudOff,
      lucideRefreshCw,
    }),
  ],
  templateUrl: './sync-status.html',
})
export class SyncStatus {
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private syncService = inject(SyncService)
  private bookService = inject(BookService)

  protected sheetOpen = signal(false)
  private isAlert = computed(() =>
    ['errors', 'offline', 'unreachable', 'failed'].includes(this.status())
  )
  protected icon = computed(() => {
    switch (this.status()) {
      case 'syncing':
        return 'lucideRefreshCw'
      case 'synced':
        return 'lucideCloudCheck'
      case 'errors':
      case 'failed':
        return 'lucideCloudAlert'
      case 'pending':
        return 'lucideCloud'
      default:
        return 'lucideCloudOff'
    }
  })
  protected iconClass = computed(() => {
    if (this.isAlert()) {
      return 'text-destructive'
    }
    return this.status() === 'synced' ? 'text-income' : 'text-muted-foreground'
  })
  /** Ops waiting, or refused items while there are errors. */
  protected count = computed(() =>
    this.status() === 'errors'
      ? this.bookService.rejectedItems().length
      : this.status() === 'synced'
        ? 0
        : this.syncService.pendingCount()
  )
  protected countClass = computed(() =>
    this.isAlert() ? 'bg-destructive text-background' : 'bg-muted-foreground text-background'
  )
  protected status = this.syncService.status
  protected label = computed(() => {
    this.languageService.language() // re-translate on a language switch
    const pending = this.syncService.pendingCount()
    const keys: Record<Status, [string, object]> = {
      errors: ['sync.errors', { count: this.bookService.rejectedItems().length }],
      offline: pending > 0 ? ['sync.offlinePending', { count: pending }] : ['sync.offline', {}],
      unreachable:
        pending > 0 ? ['sync.unreachablePending', { count: pending }] : ['sync.unreachable', {}],
      failed: pending > 0 ? ['sync.failedPending', { count: pending }] : ['sync.failed', {}],
      syncing: ['sync.syncing', {}],
      pending: ['sync.pending', { count: pending }],
      synced: ['sync.synced', {}],
    }
    const [key, params] = keys[this.status()]
    return this.transloco.translate(key, params)
  })
}
