import { Component, inject, input, output } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck, lucidePlane, lucideX } from '@ng-icons/lucide'
import { LanguageService } from '@/core/i18n'
import { shortDate } from '@/core/recurring'
import type { EventOption } from '@/core/transaction'
import { IconBadge } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { fromDay } from '@/shared/utils'

/** The transaction sheet's event / trip view (event rule 5): "ไม่มี", then the open events. */
@Component({
  selector: 'app-event-pick',
  imports: [TranslocoPipe, NgIcon, IconBadge, SheetFrame],
  providers: [provideIcons({ lucideCheck, lucidePlane, lucideX })],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './event-pick.html',
})
export class EventPick {
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)

  /** The open events, and the row's own (closed) one. */
  choices = input.required<EventOption[]>()
  chosen = input<string | null>(null)
  /** An event's id, or null for "ไม่มี". */
  picked = output<string | null>()
  back = output()

  protected icon = 'lucidePlane' as UserIcon

  /** "1 – 5 ม.ค. 2026", or "ตั้งแต่ …" for an event with no end. */
  protected dates(item: EventOption): string {
    const locale = this.languageService.locale()
    return item.endOn
      ? new Intl.DateTimeFormat(locale, {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }).formatRange(fromDay(item.startOn), fromDay(item.endOn))
      : this.transloco.translate('events.since', { date: shortDate(item.startOn, locale) })
  }
}
