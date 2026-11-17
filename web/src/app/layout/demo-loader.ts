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
  template: `
    <div class="flex flex-col items-center px-6 py-16" role="status">
      <p class="mb-5 font-semibold">{{ 'demo.loadingHeading' | transloco }}</p>
      <ol class="flex w-full max-w-72 flex-col gap-3">
        @for (step of steps(); track step.key) {
          <li class="flex items-center gap-3 text-base">
            @switch (step.state) {
              @case ('done') {
                <ng-icon name="lucideCircleCheck" size="22" class="shrink-0 text-income" />
                <span class="sr-only">{{ 'demo.stepDone' | transloco }}</span>
              }
              @case ('running') {
                <span class="flex size-[22px] shrink-0 items-center justify-center">
                  <hlm-spinner class="size-[18px]" />
                </span>
              }
              @case ('failed') {
                <ng-icon name="lucideCircleX" size="22" class="shrink-0 text-destructive" />
              }
              @default {
                <ng-icon name="lucideCircle" size="22" class="shrink-0 text-muted-foreground" />
                <span class="sr-only">{{ 'demo.stepWaiting' | transloco }}</span>
              }
            }
            <span class="tabular-nums" [class.text-muted-foreground]="step.state === 'waiting'">{{
              step.key | transloco: step.params
            }}</span>
          </li>
        }
      </ol>
      @if (failed()) {
        <p role="alert" class="mt-5 text-sm text-destructive">
          {{ 'demo.loadFailed' | transloco }}
        </p>
        <button
          hlmBtn
          variant="outline"
          type="button"
          class="mt-3 h-11 px-6 text-base"
          [disabled]="syncService.isSyncing()"
          (click)="retry()"
        >
          {{ 'demo.retry' | transloco }}
        </button>
      }
    </div>
  `,
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
