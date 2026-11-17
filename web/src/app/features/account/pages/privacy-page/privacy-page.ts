import { Component, inject, signal } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { AuthService } from '@/core/auth'

/** One section of the notice: a heading and its lines, all translation keys. */
interface NoticeSection {
  key: string
  lines: readonly string[]
}

const SECTIONS: readonly NoticeSection[] = [
  { key: 'kept', lines: ['privacy.kept1', 'privacy.kept2', 'privacy.kept3'] },
  { key: 'where', lines: ['privacy.where1', 'privacy.where2'] },
  { key: 'who', lines: ['privacy.who1', 'privacy.who2'] },
  { key: 'delete', lines: ['privacy.delete1', 'privacy.delete2', 'privacy.delete3'] },
]

/**
 * ประกาศความเป็นส่วนตัว (privacy.md rule 1): what is kept, where, who sees it and how to delete it.
 * Opened from Account (`/account/privacy`) and before sign-in (`/auth/privacy`).
 */
@Component({
  selector: 'app-privacy-page',
  imports: [TranslocoPipe],
  templateUrl: './privacy-page.html',
})
export class PrivacyPage {
  private authService = inject(AuthService)

  protected sections = SECTIONS
  /** Privacy rule 2: said only while the API is a test copy. */
  protected testVersion = signal(false)

  constructor() {
    void this.authService.providers().then((providers) => {
      this.testVersion.set(providers.testVersion)
    })
  }
}
