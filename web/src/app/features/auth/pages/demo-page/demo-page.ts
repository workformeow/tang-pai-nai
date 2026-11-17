import { NgOptimizedImage } from '@angular/common'
import { Component, inject, signal, viewChild } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideBan, lucideCheck, lucideClock } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { toApiError } from '@/core/api'
import { authErrorMessage, AuthService } from '@/core/auth'
import type { UiMessage } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { BotCheck } from '@/features/auth/components/bot-check'

/**
 * `/auth/demo` (docs/features/demo.md rule 3): what the app is, what the demo holds and what is
 * off, then one button. The link to put in a resume: opening it creates nothing, only the button
 * does (link previews and bots open links).
 */
@Component({
  selector: 'app-demo-page',
  imports: [NgOptimizedImage, RouterLink, TranslocoPipe, NgIcon, HlmButton, HlmSpinner, BotCheck],
  providers: [provideIcons({ lucideBan, lucideCheck, lucideClock })],
  templateUrl: './demo-page.html',
})
export class DemoPage {
  private router = inject(Router)
  private authService = inject(AuthService)
  private languageService = inject(LanguageService)
  protected networkStatusService = inject(NetworkStatusService)
  private botCheck = viewChild(BotCheck)

  protected readonly holds = ['demo.holdsRows', 'demo.holdsWallets', 'demo.holdsMore']
  /** `null` until the API says whether the demo is on (rule 1). */
  protected enabled = signal<boolean | null>(null)
  protected isStarting = signal(false)
  protected error = signal<UiMessage | null>(null)

  constructor() {
    void this.authService.providers().then((providers) => this.enabled.set(providers.demo))
  }

  /** Rule 4, then the shell's checklist (rule 8) and straight to Transactions. */
  protected async start(): Promise<void> {
    if (this.isStarting()) {
      return
    }
    this.isStarting.set(true)
    this.error.set(null)
    try {
      const botToken = await this.botCheck()?.token()
      await this.authService.startDemo(this.languageService.language().id, botToken)
      await this.router.navigateByUrl('/transactions', { replaceUrl: true })
    } catch (error) {
      this.error.set(authErrorMessage(toApiError(error), 'demo.startFailed'))
    } finally {
      this.botCheck()?.reset()
      this.isStarting.set(false)
    }
  }
}
