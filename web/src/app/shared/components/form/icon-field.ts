import { NgTemplateOutlet } from '@angular/common'
import { Component, input } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { glyphColor, USER_ICONS, userColor } from '@/shared/components/icon-badge'
import type { IconGroup } from '@/shared/components/icon-badge'

let nextId = 0

/**
 * Picks one icon from a curated set (lucide + `tpn`, DESIGN.md §7), as a grid (or one grid per
 * group) of 44px radio circles. The picked one shows on `color`. Icon names are labelled through `icons.<name>` keys.
 */
@Component({
  selector: 'app-icon-field',
  imports: [ReactiveFormsModule, NgTemplateOutlet, TranslocoPipe, NgIcon],
  providers: [provideIcons(USER_ICONS)],
  templateUrl: './icon-field.html',
})
export class IconField {
  control = input.required<FormControl<string>>()
  label = input.required<string>()
  /** A flat grid of icons, or `groups` for a titled grid per group. */
  icons = input<readonly string[]>([])
  groups = input<readonly IconGroup[]>([])
  /** The colour the picked icon shows on (`#rrggbb`). */
  color = input('#475569')

  protected radioName = `icon-field-${nextId++}`
  protected glyph = glyphColor
  protected userColor = userColor
}
