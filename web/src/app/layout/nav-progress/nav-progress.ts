import { Component, DestroyRef, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import {
  NavigationCancel,
  NavigationCancellationCode,
  NavigationEnd,
  NavigationError,
  NavigationStart,
  Router,
} from '@angular/router'

/** A navigation shorter than this shows nothing. */
export const NAV_PROGRESS_DELAY_MS = 300
/** How often the bar creeps on, and how long it takes to fill and fade at the end. */
const TICK_MS = 300
const FILL_MS = 200
/** Where it starts, and the most it reaches while the navigation is still running. */
const START = 0.2
const HOLD = 0.9

/**
 * The page progress bar (docs/features/loading.md rule 5): 3px along the top edge while a
 * navigation waits (a lazy page's chunk, a guard), never for the first one (the splash covers it).
 * It creeps toward 90% and holds there, since the real time can't be known, then fills and fades.
 */
@Component({
  selector: 'app-nav-progress',
  host: { 'aria-hidden': 'true' },
  templateUrl: './nav-progress.html',
})
export class NavProgress {
  protected visible = signal(false)
  protected progress = signal(0)
  protected fading = signal(false)

  private showTimer: ReturnType<typeof setTimeout> | null = null
  private hideTimer: ReturnType<typeof setTimeout> | null = null
  private tickTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    // The splash covers the first navigation, redirects included, until one ends.
    let first = true
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) {
          if (!first) {
            this.start()
          }
        } else if (
          event instanceof NavigationEnd ||
          event instanceof NavigationError ||
          (event instanceof NavigationCancel && event.code !== NavigationCancellationCode.Redirect)
        ) {
          if (first) {
            first = false
          } else {
            this.finish()
          }
        }
      })
    inject(DestroyRef).onDestroy(() => this.clear())
  }

  private start(): void {
    if (this.hideTimer) {
      // A navigation right after one ended: keep the bar where it is.
      clearTimeout(this.hideTimer)
      this.hideTimer = null
      this.fading.set(false)
      this.progress.set(Math.min(this.progress(), HOLD))
      this.creep()
      return
    }
    if (this.visible() || this.showTimer) {
      return
    }
    this.showTimer = setTimeout(() => {
      this.showTimer = null
      this.progress.set(START)
      this.visible.set(true)
      this.creep()
    }, NAV_PROGRESS_DELAY_MS)
  }

  private creep(): void {
    if (this.tickTimer) {
      return
    }
    // A share of what's left each tick: it slows down near 90% and never passes it.
    this.tickTimer = setInterval(() => {
      this.progress.update((value) => value + (HOLD - value) * 0.15)
    }, TICK_MS)
  }

  private finish(): void {
    if (this.showTimer) {
      // Done before the bar showed: nothing to see.
      clearTimeout(this.showTimer)
      this.showTimer = null
      return
    }
    if (!this.visible()) {
      return
    }
    this.stopCreeping()
    this.progress.set(1)
    this.hideTimer = setTimeout(() => {
      this.fading.set(true)
      this.hideTimer = setTimeout(() => {
        this.hideTimer = null
        this.visible.set(false)
        this.fading.set(false)
        this.progress.set(0)
      }, FILL_MS)
    }, FILL_MS)
  }

  private stopCreeping(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer)
      this.tickTimer = null
    }
  }

  private clear(): void {
    this.stopCreeping()
    for (const timer of [this.showTimer, this.hideTimer]) {
      if (timer) {
        clearTimeout(timer)
      }
    }
  }
}
