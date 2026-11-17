import { Component, input } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck } from '@ng-icons/lucide'
import { glyphColor } from '@/shared/components/icon-badge'

let nextId = 0

/** Picks one user colour (DESIGN.md §3), as a row of 44px radio swatches with a check. */
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
}
