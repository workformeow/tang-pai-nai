import { Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { HlmButton } from '@spartan-ng/helm/button'
import { PrivacyPage } from '@/features/account'

/**
 * `/auth/privacy` (privacy.md rules 1 and 3): Account's notice, open before sign-in, since signing
 * in accepts it.
 */
@Component({
  selector: 'app-privacy-notice-page',
  imports: [RouterLink, TranslocoPipe, HlmButton, PrivacyPage],
  templateUrl: './privacy-notice-page.html',
})
export class PrivacyNoticePage {}
