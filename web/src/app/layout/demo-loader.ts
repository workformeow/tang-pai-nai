import { Component, computed, inject, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCircle, lucideCircleCheck, lucideCircleX } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { OfflineService, SyncService } from '@/core/offline'
import { WalletService } from '@/core/wallet'

type StepState = 'done' | 'running' | 'waiting' | 'failed'

interface Step {
  key: string
  params?: Record<string, unknown>
  state: StepState
}

/**
 * docs/features/demo.md rule 8: a demo's first pull as a checklist instead of the one loader,
 * each line ticked when its step really ends (no fake delays). The shell shows it while a
 * demo's first round runs, and with `failed` when the round ended without the data.
 */
@Component({
  selector: 'app-demo-loader',
  imports: [TranslocoPipe, NgIcon, HlmButton, HlmSpinner],
  providers: [provideIcons({ lucideCircle, lucideCircleCheck, lucideCircleX })],
  templateUrl: './demo-loader.html',
})
export class DemoLoader {
  protected syncService = inject(SyncService)
  private offlineService = inject(OfflineService)
  private bookService = inject(BookService)
  private walletService = inject(WalletService)
  private languageService = inject(LanguageService)

  /** The round ended without the demo's data (offline, the server down or an error). */
  failed = input(false)

  protected steps = computed<Step[]>(() => {
    const failed = this.failed()
    const deviceReady = this.offlineService.isOpen()
    const masterIn = this.bookService.current() !== null && this.walletService.hasWallet()
    const rowsIn = masterIn && !this.bookService.firstPull() && !failed
    const count = this.syncService.pulledRows()
    // Each line runs once the one before it is done; a failure stops at the first one not done.
    const state = (done: boolean, previousDone: boolean): StepState => {
      if (done) {
        return 'done'
      }
      if (!previousDone) {
        return 'waiting'
      }
      return failed ? 'failed' : 'running'
    }
    return [
      // Rule 4 answered: the shell only shows once the demo account signed in.
      { key: 'demo.stepAccount', state: 'done' },
      { key: 'demo.stepDevice', state: state(deviceReady, true) },
      { key: 'demo.stepMaster', state: state(masterIn, deviceReady) },
      count > 0
        ? {
            key: 'demo.stepRows',
            params: { count: count.toLocaleString(this.languageService.locale()) },
            state: state(rowsIn, masterIn),
          }
        : { key: 'demo.stepRowsWaiting', state: state(rowsIn, masterIn) },
    ]
  })

  protected retry(): void {
    void this.syncService.sync()
  }
}
