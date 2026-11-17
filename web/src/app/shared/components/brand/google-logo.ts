import { Component } from '@angular/core'

/**
 * Google's "G" mark for the sign-in button. Its four colours are Google's own and must stay as they
 * are (Google sign-in branding guidelines), so they don't come from the theme tokens.
 */
@Component({
  selector: 'app-google-logo',
  host: { class: 'inline-flex size-5 shrink-0', 'aria-hidden': 'true' },
  templateUrl: './google-logo.html',
})
export class GoogleLogo {}
