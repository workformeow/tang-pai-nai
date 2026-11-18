import { Component, input, output, viewChild } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucidePencil } from '@ng-icons/lucide'
import { BrnField } from '@spartan-ng/brain/field'
import { HlmFieldImports } from '@spartan-ng/helm/field'
import { HlmInput } from '@spartan-ng/helm/input'
import { FALLBACK_ICON, IconBadge } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'
import { fieldErrorMessage } from './field-error'

let nextId = 0

/**
 * The compact sheet's first row (DESIGN.md §6 Compact sheet forms): the item's icon on its colour
 * (a button that opens the icon picker) and its name across the rest of the row. The label is for
 * screen readers; the placeholder says it on screen.
 */
@Component({
  selector: 'app-name-icon-field',
  imports: [ReactiveFormsModule, NgIcon, HlmFieldImports, HlmInput, IconBadge],
  providers: [provideIcons({ lucidePencil })],
  templateUrl: './name-icon-field.html',
})
export class NameIconField {
  control = input.required<FormControl<string>>()
  /** The name's label: read by screen readers and shown as the placeholder. */
  label = input.required<string>()
  icon = input.required<string>()
  color = input.required<string>()
  fallback = input<UserIcon>(FALLBACK_ICON)
  /** The icon button's label, e.g. "เปลี่ยนไอคอนและสี". */
  iconLabel = input.required<string>()
  iconClick = output()

  protected inputId = `name-icon-field-${nextId++}`
  private field = viewChild.required(BrnField)
  protected error = fieldErrorMessage(this.field)
}
