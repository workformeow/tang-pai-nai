import { Component, input } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import type { Palette, PaletteId } from '@/core/theme'

/**
 * Theme chooser (called a palette in code, see DESIGN.md §3): native radios (arrow keys, screen readers) drawn as swatches. Each swatch
 * sets `data-palette`, so it shows that palette's own background and accent in the current mode.
 */
@Component({
  selector: 'app-palette-picker',
  imports: [TranslocoPipe, ReactiveFormsModule],
  templateUrl: './palette-picker.html',
})
export class PalettePicker {
  control = input.required<FormControl<PaletteId>>()
  palettes = input.required<readonly Palette[]>()
}
