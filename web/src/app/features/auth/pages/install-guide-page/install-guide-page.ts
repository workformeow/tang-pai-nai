import { Component } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { HlmButton } from '@spartan-ng/helm/button'
import { InstallPage } from '@/features/account'

/**
 * `/auth/install` (install.md): the Account install page, reachable before sign-in so an iPhone
 * can be set up first and signed in once, inside the installed app.
 */
@Component({
  selector: 'app-install-guide-page',
  imports: [RouterLink, TranslocoPipe, HlmButton, InstallPage],
  templateUrl: './install-guide-page.html',
})
export class InstallGuidePage {}
