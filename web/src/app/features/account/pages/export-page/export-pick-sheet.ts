import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  untracked,
} from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { LanguageService } from '@/core/i18n'
import { IconBadge } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import type { PickRow } from './export-data'

/** One tab of the picker (categories have รายจ่าย and รายรับ; wallets have one, no tabs). */
export interface PickTab {
  key: string
  label: string
  rows: PickRow[]
}

/** Every id a row stands for: its own and its children's (a parent ticks its children). */
const idsOf = (row: PickRow): string[] => [row.id, ...row.children.map((child) => child.id)]

/**
 * "เลือกบางกระเป๋า" / "เลือกบางหมวด" (docs/features/export.md rule 2, mock-up frame 4): rows with a
 * tick each, children under their parent; a parent with only some ticked shows half ticked.
 * Works on a draft; "เสร็จ" hands the ids back.
 */
@Component({
  selector: 'app-export-pick-sheet',
  imports: [TranslocoPipe, HlmButton, HlmDrawerImports, IconBadge, SheetFrame],
  templateUrl: './export-pick-sheet.html',
})
export class ExportPickSheet {
  private languageService = inject(LanguageService)

  open = model(false)
  title = input.required<string>()
  tabs = input.required<PickTab[]>()
  /** The ids chosen before (the draft starts on them each time the sheet opens). */
  selected = input<readonly string[]>([])
  fallback = input.required<UserIcon>()
  picked = output<string[]>()

  protected draft = signal(new Set<string>())
  protected tabKey = signal('')
  protected rows = computed(
    () => (this.tabs().find((tab) => tab.key === this.tabKey()) ?? this.tabs().at(0))?.rows ?? []
  )

  constructor() {
    effect(() => {
      if (this.open()) {
        untracked(() => {
          this.draft.set(new Set(this.selected()))
          const first = this.tabs().find((tab) => tab.rows.some((row) => this.state(row) !== 'off'))
          this.tabKey.set((first ?? this.tabs().at(0))?.key ?? '')
        })
      }
    })
  }

  private numberFormat = computed(() => new Intl.NumberFormat(this.languageService.locale()))
  protected number(value: number): string {
    return this.numberFormat().format(value)
  }

  protected state(row: PickRow): 'on' | 'part' | 'off' {
    const draft = this.draft()
    const ids = idsOf(row)
    const ticked = ids.filter((id) => draft.has(id)).length
    return ticked === ids.length ? 'on' : ticked > 0 ? 'part' : 'off'
  }

  protected tabCount(tab: PickTab): number {
    const draft = this.draft()
    return tab.rows.flatMap(idsOf).filter((id) => draft.has(id)).length
  }

  protected toggle(row: PickRow): void {
    const next = new Set(this.draft())
    const on = this.state(row) !== 'on'
    for (const id of idsOf(row)) {
      if (on) {
        next.add(id)
      } else {
        next.delete(id)
      }
    }
    this.draft.set(next)
  }

  protected toggleOne(id: string): void {
    const next = new Set(this.draft())
    if (!next.delete(id)) {
      next.add(id)
    }
    this.draft.set(next)
  }

  protected finish(): void {
    this.picked.emit([...this.draft()])
    this.open.set(false)
  }

  protected clear(): void {
    this.draft.set(new Set())
  }
}
