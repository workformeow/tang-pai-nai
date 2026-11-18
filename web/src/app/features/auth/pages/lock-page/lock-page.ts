import { Component, computed, inject, signal, viewChild } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideLock } from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { AuthService, safeReturnUrl, SIGN_IN_URL } from '@/core/auth'
import { OfflineService, WARN_FROM_ATTEMPT } from '@/core/offline'
import { PinPad } from '@/shared/components/pin'

/**
 * The lock screen of a trusted device (offline-sync rules 2–3): the PIN pad, the warning from the
 * 3rd wrong PIN, and signing out (which wipes this device) for a forgotten PIN.
 */
@Component({
  selector: 'app-lock-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, HlmSpinner, PinPad],
  providers: [provideIcons({ lucideLock })],
  templateUrl: './lock-page.html',
})
export class LockPage {
  private router = inject(Router)
  private transloco = inject(TranslocoService)
  private authService = inject(AuthService)
  protected offlineService = inject(OfflineService)
  private returnUrl = safeReturnUrl(inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'))

  private pad = viewChild.required(PinPad)
  protected name = computed(() => this.offlineService.meta()?.displayName ?? null)
  protected isProcessing = signal(false)
  protected wrong = signal(false)
  protected confirmingSignOut = signal(false)
  protected isSigningOut = signal(false)
  /** Rule 3: from the 3rd wrong PIN in a row, also after a reload. */
  protected showWarning = computed(
    () => (this.offlineService.meta()?.failedAttempts ?? 0) >= WARN_FROM_ATTEMPT
  )

  protected async unlock(pin: string): Promise<void> {
    this.isProcessing.set(true)
    this.wrong.set(false)
    try {
      const check = await this.offlineService.unlock(pin)
      if (check === 'ok') {
        await this.router.navigateByUrl(this.returnUrl, { replaceUrl: true })
        return
      }
      if (check === 'wiped') {
        toast.error(this.transloco.translate('lock.wiped'))
        await this.router.navigateByUrl(SIGN_IN_URL, { replaceUrl: true })
        return
      }
      this.wrong.set(true)
    } catch (error) {
      console.error('Unlocking failed', error)
      this.wrong.set(true)
    } finally {
      this.isProcessing.set(false)
      this.pad().clear()
    }
  }

  /** A forgotten PIN: this device forgets everything and signs out (rules 3 and 7). */
  protected async signOut(): Promise<void> {
    this.isSigningOut.set(true)
    try {
      await this.offlineService.wipe()
      await this.authService.signOutOrLater().catch(() => undefined)
      await this.router.navigateByUrl(SIGN_IN_URL, { replaceUrl: true })
    } finally {
      this.isSigningOut.set(false)
    }
  }
}
