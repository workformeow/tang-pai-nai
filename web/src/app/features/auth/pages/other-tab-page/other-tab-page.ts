import { Component, inject, signal } from '@angular/core'
import { ActivatedRoute, Router } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideAppWindow } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { safeReturnUrl } from '@/core/auth'
import { OfflineService } from '@/core/offline'

/** The app runs in one tab at a time (offline-sync rule 2); this tab can take it over. */
@Component({
  selector: 'app-other-tab-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, HlmSpinner],
  providers: [provideIcons({ lucideAppWindow })],
  templateUrl: './other-tab-page.html',
})
export class OtherTabPage {
  private router = inject(Router)
  private offlineService = inject(OfflineService)
  private returnUrl = safeReturnUrl(inject(ActivatedRoute).snapshot.queryParamMap.get('returnUrl'))

  protected isTakingOver = signal(false)

  protected async useHere(): Promise<void> {
    this.isTakingOver.set(true)
    await this.offlineService.takeOver()
    await this.router.navigateByUrl(this.returnUrl, { replaceUrl: true })
  }
}
