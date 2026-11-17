import { Component, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronDown, lucideChevronRight, lucidePlane } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { EVENT_DEFAULT_ICON, EVENTS_ROUTE, EventService } from '@/core/event'
import { LanguageService } from '@/core/i18n'
import { EventSheet } from '@/features/events/components/event-sheet'
import { eventRow } from '@/features/events/event-view'
import { EmptyState } from '@/shared/components/empty-state'
import { IconBadge } from '@/shared/components/icon-badge'

/**
 * อีเวนต์ / ทริป (docs/features/event.md → Web screens 1, mock-up frame 1): open events by start
 * date ("กำลังใช้" while today is in their dates), "จบแล้ว (n)" folded, and "เพิ่มอีเวนต์".
 */
@Component({
  selector: 'app-events-page',
  imports: [TranslocoPipe, NgIcon, HlmButton, RouterLink, EmptyState, IconBadge, EventSheet],
  providers: [provideIcons({ lucideChevronDown, lucideChevronRight, lucidePlane })],
  templateUrl: './events-page.html',
})
export class EventsPage {
  protected eventService = inject(EventService)
  private languageService = inject(LanguageService)
  private transloco = inject(TranslocoService)
  private activatedRoute = inject(ActivatedRoute)
  private router = inject(Router)

  protected readonly route = EVENTS_ROUTE
  protected eventIcon = EVENT_DEFAULT_ICON
  protected showClosed = signal(false)

  private rows = computed(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params)
    return this.eventService.items().map((item) => eventRow(item, t, locale))
  })
  protected open = computed(() => this.rows().filter((row) => !row.item.event.isClosed))
  protected closed = computed(() => this.rows().filter((row) => row.item.event.isClosed))

  constructor() {
    this.activatedRoute.queryParamMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const fix = params.get('fix')
      if (fix) {
        this.eventService.openFix(fix)
        void this.router.navigate([], { queryParams: {}, replaceUrl: true })
      }
    })
  }
}
