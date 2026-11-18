import type { ElementRef } from '@angular/core'
import { Component, effect, input, output, viewChild } from '@angular/core'

/** One chip: the period's id (an offset, or a word such as "future") and its label. */
export interface PeriodChip {
  id: number | string
  label: string
}

/**
 * The period chips under a tab's header (transaction.md → Web screens, DESIGN.md §2): one row
 * that scrolls sideways without a scrollbar, the chosen chip kept in view.
 */
@Component({
  selector: 'app-period-strip',
  host: { class: 'block' },
  templateUrl: './period-strip.html',
})
export class PeriodStrip {
  chips = input.required<readonly PeriodChip[]>()
  selected = input.required<number | string>()
  /** The tablist's accessible name. */
  label = input.required<string>()
  chosen = output<number | string>()

  private strip = viewChild.required<ElementRef<HTMLElement>>('strip')

  constructor() {
    // Keep the chosen chip in view (the strip starts at the oldest period).
    effect(() => {
      const selected = this.selected()
      this.chips()
      const strip = this.strip().nativeElement
      queueMicrotask(() => {
        const button = strip.querySelector<HTMLElement>(`[data-tab="${String(selected)}"]`)
        if (button) {
          strip.scrollLeft = button.offsetLeft - (strip.clientWidth - button.offsetWidth) / 2
        }
      })
    })
  }
}
