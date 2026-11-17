import { Location } from '@angular/common'
import { Component, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideLink2Off } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { toApiError } from '@/core/api'
import { AuthService, authErrorMessage } from '@/core/auth'
import type { UiMessage } from '@/core/auth'
import { AuthFlowStore } from '@/features/auth/auth-flow.store'

const TOKEN_PATTERN = /^[\w-]{43}$/

/**
 * `/auth/link#token=…` from the sign-in email. The token sits in the fragment, which never reaches
 * a server log or `Referer`, and is POSTed, so mail scanners that open links can't use it
 * (auth spec rule 8).
 */
@Component({
  selector: 'app-magic-link-page',
  imports: [TranslocoPipe, RouterLink, NgIcon, HlmButton, HlmSpinner],
  providers: [provideIcons({ lucideLink2Off })],
  templateUrl: './magic-link-page.html',
})
export class MagicLinkPage {
  private router = inject(Router)
  private location = inject(Location)
  private authService = inject(AuthService)
  private authFlowStore = inject(AuthFlowStore)

  protected error = signal<UiMessage | null>(null)

  constructor() {
    // Each new fragment is a new link, even when the page is already open.
    inject(ActivatedRoute)
      .fragment.pipe(takeUntilDestroyed())
      .subscribe((fragment) => {
        const token = new URLSearchParams(fragment ?? '').get('token') ?? ''
        // Drop the token from the address bar and history right away.
        this.location.replaceState('/auth/link')
        void this.verify(token)
      })
  }

  private async verify(token: string): Promise<void> {
    this.error.set(null)
    if (!TOKEN_PATTERN.test(token)) {
      this.error.set({ key: 'auth.linkMissing' })
      return
    }
    try {
      await this.authService.verifyLink(token)
      this.authFlowStore.clear()
      await this.router.navigateByUrl('/', { replaceUrl: true })
    } catch (error) {
      const message = authErrorMessage(toApiError(error), 'auth.linkFailed')
      // A dead link has no "send a new code" button here, so it gets its own wording.
      const isDead = ['auth.codeExpired', 'auth.codeLocked'].includes(message.key)
      this.error.set(isDead ? { key: 'auth.linkExpired' } : message)
    }
  }
}
