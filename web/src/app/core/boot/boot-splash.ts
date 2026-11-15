import { DOCUMENT, inject, Service } from '@angular/core'

/** What the splash says it waits for (docs/features/loading.md rule 2). */
export type BootStep = 'app' | 'auth' | 'data'

/** How long the splash takes to fade out (its CSS transition in index.html). */
const FADE_MS = 150

/**
 * The splash in `index.html` (docs/features/loading.md rules 1–3): its timers and words live
 * there; this sets its step and takes it away. Without the splash (tests) it does nothing.
 */
@Service()
export class BootSplash {
  private document = inject(DOCUMENT)

  step(step: BootStep): void {
    const splash = this.splash()
    if (splash) {
      splash.dataset['step'] = step
    }
  }

  /** Rule 1: the first navigation ended; fade out, then leave the page. */
  done(): void {
    const splash = this.splash()
    if (!splash || splash.classList.contains('boot-out')) {
      return
    }
    splash.classList.add('boot-out')
    setTimeout(() => splash.remove(), FADE_MS + 50)
  }

  private splash(): HTMLElement | null {
    return this.document.getElementById('boot-splash')
  }
}
