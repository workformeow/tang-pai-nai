import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, input } from '@angular/core'
import { toObservable, toSignal } from '@angular/core/rxjs-interop'
import type { FormControl } from '@angular/forms'
import { switchMap } from 'rxjs'
import { IconBadge } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'

/** One row of `app-toggle-list-field`. */
export interface ToggleListItem {
  id: string
  label: string
  icon: string
  color: string
  fallback: UserIcon
  /** A child row: a 32px badge, indented under its parent. */
  child?: boolean
  /**
   * Shown off and can't change, with this line under the label (e.g. hidden with its parent).
   */
  lockedNote?: string | null
}

/**
 * A list of things with a switch each (category rule 13: the categories a wallet uses, the
 * wallets a category is used in). The control holds the ids switched **off**. Each row is one
 * 56px switch button (the whole row toggles), drawn like `hlm-switch`.
 */
@Component({
  selector: 'app-toggle-list-field',
  imports: [NgTemplateOutlet, IconBadge],
  templateUrl: './toggle-list-field.html',
})
export class ToggleListField {
  control = input.required<FormControl<string[]>>()
  /** Names the list for screen readers. */
  label = input.required<string>()
  items = input.required<readonly ToggleListItem[]>()
  /**
   * A master switch in its own card above the list ("ใช้ทุกกระเป๋า"): on while every row that
   * isn't locked is on. Switching it on turns every row on; switching it off turns the top-level
   * rows off (a parent switched off takes its children with it, category rule 13). Locked rows
   * stay as they are. Null leaves it out.
   */
  allLabel = input<string | null>(null)
  /** The line under the master switch, e.g. "ใช้ 3 จาก 4 กระเป๋า". */
  allNote = input('')

  /**
   * The ids switched off, as a signal: the page may set the control itself ("เลือกทั้งหมด"), and
   * reading `control().value` in the template wouldn't redraw the switches then.
   */
  private changed = toSignal(
    toObservable(this.control).pipe(switchMap((control) => control.valueChanges)),
    { initialValue: null, equal: () => false }
  )
  protected off = computed(() => {
    this.changed()
    return this.control().value
  })

  /** Each top-level row with the child rows that follow it. */
  protected groups = computed(() => {
    const groups: { item: ToggleListItem; children: ToggleListItem[] }[] = []
    for (const item of this.items()) {
      const last = groups.at(-1)
      if (item.child && last) {
        last.children.push(item)
      } else {
        groups.push({ item, children: [] })
      }
    }
    return groups
  })

  /** The rows the master switch can change. */
  private free = computed(() => this.items().filter((item) => !item.lockedNote))
  protected allOn = computed(() => {
    const off = this.off()
    const free = this.free()
    return free.length > 0 && free.every((item) => !off.includes(item.id))
  })
  protected canSetAll = computed(() => this.free().length > 0)

  protected setAll(on: boolean): void {
    const control = this.control()
    const off = control.value
    if (on) {
      // Every free row, and each child locked only because its parent here is off.
      const clear = new Set<string>()
      for (const { item, children } of this.groups()) {
        if (item.lockedNote) {
          continue
        }
        clear.add(item.id)
        for (const child of children) {
          if (!child.lockedNote || off.includes(item.id)) {
            clear.add(child.id)
          }
        }
      }
      control.setValue(off.filter((id) => !clear.has(id)))
    } else {
      const add = this.groups()
        .map((group) => group.item)
        .filter((item) => !item.lockedNote && !off.includes(item.id))
        .map((item) => item.id)
      control.setValue([...off, ...add])
    }
    control.markAsDirty()
  }

  protected toggle(id: string): void {
    const control = this.control()
    const off = control.value
    control.setValue(off.includes(id) ? off.filter((other) => other !== id) : [...off, id])
    control.markAsDirty()
  }
}
