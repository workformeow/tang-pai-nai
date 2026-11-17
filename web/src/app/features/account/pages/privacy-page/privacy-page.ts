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
  template: `
    <div class="flex flex-col gap-6 p-4">
      <p class="text-base">{{ 'privacy.intro' | transloco }}</p>

      @if (testVersion()) {
        <p role="note" class="rounded-xl bg-muted px-4 py-3 text-sm">
          {{ 'privacy.testVersion' | transloco }}
        </p>
      }

      @for (section of sections; track section.key) {
        <section class="flex flex-col gap-2" [attr.aria-labelledby]="'privacy-' + section.key">
          <h2 [id]="'privacy-' + section.key" class="text-base font-semibold">
            {{ 'privacy.heading.' + section.key | transloco }}
          </h2>
          <ul class="flex list-disc flex-col gap-1.5 ps-5 text-sm text-muted-foreground">
            @for (line of section.lines; track line) {
              <li>{{ line | transloco }}</li>
            }
          </ul>
        </section>
      }

      <p class="text-sm text-muted-foreground">{{ 'privacy.updated' | transloco }}</p>
    </div>
  `,
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
