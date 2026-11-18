import { booleanAttribute, Component, input } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import type { SelectOption } from '@/shared/types'

let nextId = 0

/**
 * Picks one of two or three short options as a segmented control (radios under the hood), e.g.
 * รายจ่าย / รายรับ. The label is for screen readers unless `showLabel` (a settings row, Account ›
 * การแสดงผล); a disabled control reads as locked.
 */
@Component({
  selector: 'app-segmented-field',
  imports: [ReactiveFormsModule],
  // A block, so a margin given by the page applies.
  host: { class: 'block' },
  templateUrl: './segmented-field.html',
})
export class SegmentedField {
  control = input.required<FormControl<string>>()
  label = input.required<string>()
  options = input.required<readonly SelectOption[]>()
  showLabel = input(false, { transform: booleanAttribute })

  protected group = `segmented-field-${nextId++}`
}
