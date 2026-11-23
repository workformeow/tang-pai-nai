import { Component, input } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck } from '@ng-icons/lucide'
import { COLOR_SHADES, colorTone, glyphColor } from '@/shared/components/icon-badge'

let nextId = 0

/**
 * Picks one user colour (DESIGN.md §3): 44px radio swatches with a check, one per tone, and
 * under the chosen tone a strip of its shades (`COLOR_SHADES`). Picking a tone picks its own
 * colour; the tone's swatch then shows whichever shade is chosen.
 */
@Component({
  selector: 'app-color-field',
  imports: [ReactiveFormsModule, TranslocoPipe, NgIcon],
  providers: [provideIcons({ lucideCheck })],
  templateUrl: './color-field.html',
})
export class ColorField {
  control = input.required<FormControl<string>>()
  label = input.required<string>()
  colors = input.required<readonly string[]>()

  protected group = `color-field-${nextId++}`
  protected glyph = glyphColor

  /** The listed tone that holds `value`, or null (a colour outside the palette). */
  protected toneOf(value: string): string | null {
    const tone = colorTone(value)
    return tone !== null && this.colors().includes(tone) ? tone : null
  }

  protected shadesOf(tone: string): readonly string[] | undefined {
    return COLOR_SHADES[tone]
  }

  protected pickTone(color: string): void {
    this.control().setValue(color)
    this.control().markAsDirty()
  }
}
