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
  template: `
    <div class="flex flex-1 flex-col gap-2">
      <h1 class="text-2xl font-semibold">{{ 'title.privacy' | transloco }}</h1>
      <app-privacy-page class="-mx-4 block" />
      <a hlmBtn variant="outline" routerLink="/auth/sign-in" class="mt-auto h-11 w-full text-base">
        {{ 'auth.backToSignIn' | transloco }}
      </a>
    </div>
  `,
})
export class PrivacyNoticePage {}
