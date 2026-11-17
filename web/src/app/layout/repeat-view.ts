import { Component, computed, inject, input, model } from '@angular/core'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideMinus, lucidePlus } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { LanguageService } from '@/core/i18n'
import {
  lastLine,
  MONTHLY,
  RECURRING_FREQUENCIES,
  RECURRING_LIMITS,
  shortDate,
  shortMonthLine,
} from '@/core/recurring'
import type { RecurringFrequency, RepeatValues } from '@/core/recurring'
import { addMonths, fromDay } from '@/shared/utils'

type Choice = 'none' | RecurringFrequency | 'custom'
type End = 'never' | 'on' | 'count'

/**
 * The "ทำซ้ำ" view of the transaction and transfer sheets (docs/features/recurring.md → Web
 * screens, mock-up frames 2 and 4): the presets named after the form's date, "every n units",
 * the end (never / a date / a count) and whether a due one is recorded by itself or asked first.
 * Every change goes straight to `value` (null: don't repeat); the sheet's ‹ goes back.
 */
@Component({
  selector: 'app-repeat-view',
  imports: [TranslocoPipe, NgIcon, HlmButton],
  providers: [provideIcons({ lucideMinus, lucidePlus })],
  host: { class: 'flex flex-col gap-4' },
  templateUrl: './repeat-view.html',
})
export class RepeatView {
  private transloco = inject(TranslocoService)
  private languageService = inject(LanguageService)

  /** The form's date: the presets are named after it, and the rule starts on it. */
  startOn = input.required<string>()
  value = model<RepeatValues | null>(null)

  protected units = RECURRING_FREQUENCIES
  protected intervalMax = RECURRING_LIMITS.INTERVAL_MAX
  protected countMax = RECURRING_LIMITS.COUNT_MAX
  protected interval = computed(() => this.value()?.interval ?? 2)
  protected frequency = computed(() => this.value()?.frequency ?? 'month')
  protected choice = computed<Choice>(() => {
    const value = this.value()
    if (!value) {
      return 'none'
    }
    return value.interval === 1 ? value.frequency : 'custom'
  })
  protected end = computed<End>(() => {
    const value = this.value()
    return (value?.endCount ?? null) !== null
      ? 'count'
      : (value?.endOn ?? null) !== null
        ? 'on'
        : 'never'
  })

  protected options = computed(() => {
    this.languageService.language()
    const locale = this.languageService.locale()
    const t = (key: string, params?: Record<string, unknown>) =>
      this.transloco.translate(key, params)
    const start = this.startOn()
    const date = fromDay(start)
    const params = {
      weekday: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
      day: date.getDate(),
      date: shortDate(start, locale, false),
    }
    const hint = (frequency: RecurringFrequency) =>
      frequency === 'day' ? '' : t(`recurring.hint.${frequency}`, params)
    return [
      { id: 'none' as const, label: t('recurring.none'), hint: '' },
      ...RECURRING_FREQUENCIES.map((frequency) => ({
        id: frequency,
        label: t(`recurring.preset.${frequency}`),
        hint: hint(frequency),
      })),
    ]
  })
  protected shortMonth = computed(() => {
    this.languageService.language()
    const value = this.value()
    return value
      ? shortMonthLine(
          value,
          this.startOn(),
          (key, params) => this.transloco.translate(key, params),
          this.languageService.locale()
        )
      : null
  })
  protected last = computed(() => {
    this.languageService.language()
    const value = this.value()
    return value
      ? lastLine(
          { ...value, startOn: this.startOn() },
          (key, params) => this.transloco.translate(key, params),
          this.languageService.locale()
        )
      : null
  })
  protected endOnText = computed(() => {
    const endOn = this.value()?.endOn
    return endOn ? shortDate(endOn, this.languageService.locale()) : ''
  })

  protected choose(choice: Choice): void {
    if (choice === 'none') {
      this.value.set(null)
      return
    }
    const current = this.value() ?? MONTHLY
    if (choice === 'custom') {
      this.value.set({ ...current, interval: Math.max(2, current.interval) })
      return
    }
    this.value.set({ ...current, frequency: choice, interval: 1 })
  }

  protected setInterval(interval: number): void {
    this.update({ interval: Math.min(this.intervalMax, Math.max(2, interval)) })
  }

  protected setFrequency(frequency: RecurringFrequency): void {
    this.update({ frequency })
  }

  protected setEnd(end: End): void {
    const current = this.value()
    if (!current) {
      return
    }
    this.value.set({
      ...current,
      endOn: end === 'on' ? (current.endOn ?? addMonths(this.startOn(), 12)) : null,
      endCount: end === 'count' ? (current.endCount ?? 12) : null,
    })
  }

  protected setEndOn(event: Event): void {
    const day = (event.target as HTMLInputElement).value
    if (day && day >= this.startOn()) {
      this.update({ endOn: day, endCount: null })
    }
  }

  protected setCount(count: number): void {
    this.update({ endCount: Math.min(this.countMax, Math.max(1, count)), endOn: null })
  }

  protected update(changes: Partial<RepeatValues>): void {
    const current = this.value()
    if (current) {
      this.value.set({ ...current, ...changes })
    }
  }
}
