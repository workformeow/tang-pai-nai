import { linkedSignal } from '@angular/core'
import type { Signal, WritableSignal } from '@angular/core'

/**
 * A sheet's state as its content reads it: the open one, and while the drawer animates closed
 * (its state already null) still the last one, so the title and rows don't change on the way
 * out. A sheet opens and closes on `source` itself; this follows it.
 *
 * ```ts
 * protected state = keepWhileClosing(this.walletService.sheet)
 * ```
 */
export const keepWhileClosing = <T>(source: Signal<T | null>): WritableSignal<T | null> =>
  linkedSignal<T | null, T | null>({
    source,
    computation: (next, previous) => next ?? previous?.value ?? null,
  })
