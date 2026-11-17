import { Component } from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { LanguageSwitch } from './language-switch'

/** Full-screen layout for the sign-in flow: outside the app shell, so no tab bar. */
@Component({
  selector: 'app-auth-layout',
  imports: [RouterOutlet, TranslocoPipe, LanguageSwitch],
  templateUrl: './auth-layout.html',
})
export class AuthLayout {}
