import { Component, input, output } from '@angular/core'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronRight, lucideRepeat } from '@ng-icons/lucide'

/**
 * A row of the transaction and transfer forms for recurring (docs/features/recurring.md → Web
 * screens): "ทำซ้ำ · ไม่ทำซ้ำ ›", the rule once one is set (in the accent colour, its end and
 * how it records under it), or "จากรายการซ้ำ" on a recorded occurrence. A tap opens it.
 */
@Component({
  selector: 'app-repeat-row',
  imports: [NgIcon],
  providers: [provideIcons({ lucideChevronRight, lucideRepeat })],
  templateUrl: './repeat-row.html',
})
export class RepeatRow {
  /** What the row is, for screen readers ("ทำซ้ำ", "จากรายการซ้ำ"). */
  label = input.required<string>()
  title = input.required<string>()
  sub = input('')
  /** A rule is set: the title in the accent colour. */
  active = input(false)
  pressed = output()
}
