import { Component, computed, DestroyRef, inject, signal } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { AuthStore } from '@/core/auth'

const HOUR_MS = 3_600_000
/** Demo rule 13: the cron deletes a demo this long after it was made. */
const DEMO_LIFETIME_MS = 24 * HOUR_MS

/**
 * Demo rule 10 (Q2: can't be closed, one thin line): "โหมด Demo · ข้อมูลจะถูกลบใน n ชั่วโมง" at
 * the top of the shell, the hours counted from the account's `createdAt`.
 */
@Component({
  selector: 'app-demo-banner',
  imports: [TranslocoPipe],
  host: { role: 'status' },
  templateUrl: './demo-banner.html',
})
export class DemoBanner {
  private authStore = inject(AuthStore)
  /** Ticks each minute, so the hours go down while the app stays open. */
  private now = signal(Date.now())

  /** Whole hours left (at least 1 until the cron runs); null when this isn't a demo. */
  protected hoursLeft = computed(() => {
    const user = this.authStore.user()
    if (!user?.isDemo) {
      return null
    }
    const left = Date.parse(user.createdAt) + DEMO_LIFETIME_MS - this.now()
    return Math.max(1, Math.ceil(left / HOUR_MS))
  })

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 60_000)
    inject(DestroyRef).onDestroy(() => clearInterval(timer))
  }
}
