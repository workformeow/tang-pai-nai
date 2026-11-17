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
  template: `
    <div class="flex flex-1 flex-col gap-6">
      <div class="flex flex-col items-center gap-3 pt-4 text-center">
        <img
          ngSrc="icons/icon-192x192.png"
          width="72"
          height="72"
          alt=""
          class="rounded-2xl"
          priority
        />
        <h1 class="text-2xl font-semibold">{{ 'demo.heading' | transloco }}</h1>
        <p class="text-base text-muted-foreground">{{ 'demo.intro' | transloco }}</p>
        <p class="text-base text-muted-foreground">{{ 'demo.introDemo' | transloco }}</p>
      </div>

      <section
        class="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground"
        aria-labelledby="demo-holds"
      >
        <h2 id="demo-holds" class="text-sm font-medium text-muted-foreground">
          {{ 'demo.holdsHeading' | transloco }}
        </h2>
        <ul class="flex flex-col gap-2 text-base">
          @for (key of holds; track key) {
            <li class="flex items-start gap-2">
              <ng-icon name="lucideCheck" class="mt-1 shrink-0 text-income" aria-hidden="true" />
              {{ key | transloco }}
            </li>
          }
          <li class="flex items-start gap-2">
            <ng-icon
              name="lucideClock"
              class="mt-1 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            {{ 'demo.deletedIn24h' | transloco }}
          </li>
        </ul>
        <h2 class="pt-1 text-sm font-medium text-muted-foreground">
          {{ 'demo.offHeading' | transloco }}
        </h2>
        <p class="flex items-start gap-2 text-base">
          <ng-icon
            name="lucideBan"
            class="mt-1 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          {{ 'demo.offList' | transloco }}
        </p>
      </section>

      @if (!networkStatusService.isOnline()) {
        <p role="status" class="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{ 'auth.offline' | transloco }}
        </p>
      }

      @if (enabled() === false) {
        <p role="status" class="rounded-xl bg-muted px-4 py-3 text-sm">
          {{ 'demo.disabled' | transloco }}
        </p>
      } @else {
        <div class="flex flex-col gap-4">
          @if (error(); as message) {
            <p role="alert" class="text-sm text-destructive">
              {{ message.key | transloco: message.params }}
            </p>
          }
          <app-bot-check />
          <button
            hlmBtn
            type="button"
            class="h-11 w-full text-base"
            [disabled]="isStarting() || enabled() === null || !networkStatusService.isOnline()"
            (click)="start()"
          >
            @if (isStarting()) {
              <hlm-spinner [aria-label]="'demo.starting' | transloco" />
            }
            {{ 'demo.start' | transloco }}
          </button>
        </div>
      }

      <a hlmBtn variant="outline" routerLink="/auth/sign-in" class="mt-auto h-11 w-full text-base">
        {{ 'auth.backToSignIn' | transloco }}
      </a>
    </div>
  `,
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
