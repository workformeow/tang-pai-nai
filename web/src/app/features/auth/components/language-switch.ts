import { Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { LANGUAGES, LanguageService } from '@/core/i18n'
import type { Language } from '@/core/i18n'

/**
 * TH | EN, for screens before sign-in (the account page isn't reachable yet). The codes read the
 * same in either language, so someone stuck in the wrong one can still find theirs.
 */
@Component({
  selector: 'app-language-switch',
  imports: [TranslocoPipe],
  templateUrl: './language-switch.html',
})
export class LanguageSwitch {
  protected languageService = inject(LanguageService)
  protected readonly languages = LANGUAGES

  protected select(id: Language): void {
    this.languageService.setLanguage(id).catch((error: unknown) => {
      console.error('Language switch failed', error)
    })
  }
}
