import { Component, ElementRef, inject, signal, viewChild } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCalendarRange, lucideCheck, lucideChevronDown } from '@ng-icons/lucide'
import { PERIOD_UNITS, PeriodService } from '@/core/transaction'
import type { PeriodUnit } from '@/core/transaction'

/**
 * "ดูตาม" at the top right of a report page that has no ⋮ (the all-currencies page, #24): the
 * period both tabs share (`PeriodService`), so a change here is theirs too.
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
  templateUrl: './report-unit-menu.html',
})
export class ReportUnitMenu {
  protected periodService = inject(PeriodService)
  private host = inject<ElementRef<HTMLElement>>(ElementRef)
  private button = viewChild.required<ElementRef<HTMLElement>>('button')
  private menu = viewChild<ElementRef<HTMLElement>>('menu')

  protected readonly units = PERIOD_UNITS
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

  protected choose(unit: PeriodUnit): void {
    this.close(true)
    if (unit === 'custom') {
      this.periodService.customSheet.set(true)
    } else {
      this.periodService.selectUnit(unit)
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
