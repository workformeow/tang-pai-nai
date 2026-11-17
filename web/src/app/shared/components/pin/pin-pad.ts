import { Component, computed, input, output, signal } from '@angular/core'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideDelete } from '@ng-icons/lucide'

export const PIN_LENGTH = 6

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as const

/**
 * A 6-digit PIN typed on an on-screen 3×4 keypad, like a banking app, so the phone keyboard never
 * opens (offline-sync → Web screens). The sixth digit emits `completed`; the parent calls
 * `clear()` for the next try. A hardware keyboard works too (digits, Backspace).
 */
@Component({
  selector: 'app-pin-pad',
  imports: [NgIcon],
  providers: [provideIcons({ lucideDelete })],
  host: {
    // "33" or "55" typed fast must not zoom the page (pinch zoom still works).
    class: 'flex touch-manipulation flex-col items-center gap-8',
    '(document:keydown)': 'onKey($event)',
  },
  templateUrl: './pin-pad.html',
})
export class PinPad {
  /** Read out with the count, e.g. "PIN, 2 of 6 digits entered" (translated by the parent). */
  filledLabel = input.required<string>()
  deleteLabel = input.required<string>()
  disabled = input(false)
  completed = output<string>()

  protected readonly keys = KEYS
  protected readonly dots = Array.from({ length: PIN_LENGTH }, (_, i) => i)
  protected digits = signal('')
  /** How many digits are in, for the parent's label. */
  length = computed(() => this.digits().length)

  clear(): void {
    this.digits.set('')
  }

  protected press(key: string): void {
    if (this.disabled() || this.digits().length >= PIN_LENGTH) {
      return
    }
    const next = this.digits() + key
    this.digits.set(next)
    if (next.length === PIN_LENGTH) {
      this.completed.emit(next)
    }
  }

  protected backspace(): void {
    if (!this.disabled()) {
      this.digits.update((digits) => digits.slice(0, -1))
    }
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return
    }
    if (/^\d$/.test(event.key)) {
      event.preventDefault()
      this.press(event.key)
    } else if (event.key === 'Backspace') {
      event.preventDefault()
      this.backspace()
    }
  }
}
