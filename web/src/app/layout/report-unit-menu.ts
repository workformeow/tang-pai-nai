import { Component, ElementRef, inject, signal, viewChild } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCalendarRange, lucideCheck, lucideChevronDown } from '@ng-icons/lucide'
import { REPORT_UNITS, ReportService } from '@/core/report'
import type { ReportUnit } from '@/core/report'

/**
 * "ดูตาม" at the top right of a report page that has no ⋮ (the all-currencies page, #24): the
 * Reports tab's own units, so a change here is the Reports tab's change too. `app-header`
 * `@defer`s it, which keeps `ReportService` out of the shell.
 */
@Component({
  selector: 'app-report-unit-menu',
  imports: [TranslocoPipe, NgIcon],
  providers: [provideIcons({ lucideCalendarRange, lucideCheck, lucideChevronDown })],
  host: {
    class: 'relative block',
    '(document:click)': 'onDocumentClick($event)',
    '(keydown.escape)': 'close(true)',
  },
  template: `
    <button
      #button
      type="button"
      class="tpn-hit flex h-9 items-center gap-1.5 tpn-glass rounded-full pr-2.5 pl-3 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      aria-haspopup="menu"
      [attr.aria-expanded]="open()"
      [attr.aria-label]="
        ('transactions.viewBy' | transloco) +
        ' ' +
        ('transactions.unit.' + reportService.unit() | transloco)
      "
      (click)="toggle()"
    >
      <ng-icon name="lucideCalendarRange" size="16" aria-hidden="true" />
      {{ 'transactions.unit.' + reportService.unit() | transloco }}
      <ng-icon
        name="lucideChevronDown"
        size="14"
        class="text-muted-foreground"
        aria-hidden="true"
      />
    </button>
    @if (open()) {
      <div
        #menu
        role="menu"
        tabindex="-1"
        class="absolute top-full right-0 z-30 mt-1 min-w-48 rounded-xl border border-border bg-popover py-1.5 text-popover-foreground shadow-lg"
        [attr.aria-label]="'transactions.viewBy' | transloco"
        (keydown)="onKey($event)"
      >
        @for (unit of units; track unit) {
          <button
            type="button"
            role="menuitemradio"
            class="flex min-h-11 w-full items-center justify-between gap-6 px-4 text-left text-base focus-visible:bg-muted focus-visible:outline-none"
            [class.font-semibold]="unit === reportService.unit()"
            [class.text-brand]="unit === reportService.unit()"
            [attr.aria-checked]="unit === reportService.unit()"
            (click)="choose(unit)"
          >
            {{ 'transactions.unit.' + unit | transloco }}
            @if (unit === reportService.unit()) {
              <ng-icon name="lucideCheck" size="18" aria-hidden="true" />
            }
          </button>
        }
      </div>
    }
  `,
})
export class ReportUnitMenu {
  protected reportService = inject(ReportService)
  private host = inject<ElementRef<HTMLElement>>(ElementRef)
  private button = viewChild.required<ElementRef<HTMLElement>>('button')
  private menu = viewChild<ElementRef<HTMLElement>>('menu')

  protected readonly units = REPORT_UNITS
  protected open = signal(false)

  protected toggle(): void {
    if (this.open()) {
      this.close(false)
      return
    }
    this.open.set(true)
    // Focus the chosen unit, like a native menu.
    setTimeout(() =>
      this.menu()?.nativeElement.querySelector<HTMLElement>('[aria-checked="true"]')?.focus()
    )
  }

  protected close(refocus: boolean): void {
    if (!this.open()) {
      return
    }
    this.open.set(false)
    if (refocus) {
      this.button().nativeElement.focus()
    }
  }

  protected choose(unit: ReportUnit): void {
    this.close(true)
    if (unit === 'custom') {
      this.reportService.customSheet.set(true)
    } else {
      this.reportService.selectUnit(unit)
    }
  }

  protected onDocumentClick(event: MouseEvent): void {
    if (this.open() && !event.composedPath().includes(this.host.nativeElement)) {
      this.close(false)
    }
  }

  /** ↑ / ↓ move between the units, Home / End to the ends (menu pattern). */
  protected onKey(event: KeyboardEvent): void {
    const items = [
      ...(this.menu()?.nativeElement.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? []),
    ]
    const index = items.indexOf(document.activeElement as HTMLElement)
    const moves: Partial<Record<string, number>> = {
      ArrowDown: index + 1,
      ArrowUp: index - 1,
      Home: 0,
      End: items.length - 1,
    }
    const next = moves[event.key]
    if (next === undefined) {
      return
    }
    event.preventDefault()
    items[(next + items.length) % items.length]?.focus()
  }
}
