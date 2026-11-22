import type { ElementRef } from '@angular/core'
import { afterNextRender, Component, input, output, viewChild } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { BrnField } from '@spartan-ng/brain/field'
import { HlmFieldImports } from '@spartan-ng/helm/field'
import { HlmTextarea } from '@spartan-ng/helm/textarea'
import { fieldErrorMessage } from './field-error'

@Component({
  selector: 'app-textarea-field',
  imports: [ReactiveFormsModule, HlmFieldImports, HlmTextarea],
  templateUrl: './textarea-field.html',
})
export class TextareaField {
  control = input.required<FormControl<string>>()
  label = input.required<string>()
  placeholder = input('')
  hint = input('')
  rows = input(3)
  /** The label for screen readers only, when the sheet's title already says it. */
  hideLabel = input(false)
  maxLength = input<number | null>(null)
  /** Focus the text on first render, so the phone's keyboard comes up at once. */
  autofocus = input(false)
  /**
   * The keyboard's return key reads "done" and finishes instead of starting a new line
   * (Shift + Enter still does), and leaving the text (the iOS keyboard's ✓) finishes too.
   */
  doneOnEnter = input(false)
  done = output()

  private field = viewChild.required(BrnField)
  private textarea = viewChild.required<ElementRef<HTMLTextAreaElement>>('textarea')
  protected error = fieldErrorMessage(this.field)

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) {
        this.textarea().nativeElement.focus({ preventScroll: true })
      }
    })
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.doneOnEnter() || event.key !== 'Enter' || event.shiftKey || event.isComposing) {
      return
    }
    event.preventDefault()
    this.done.emit()
  }

  /** Only a blur the user made: not the app or tab going to the background. */
  protected onBlur(): void {
    const doc = this.textarea().nativeElement.ownerDocument
    if (this.doneOnEnter() && !doc.hidden && doc.hasFocus()) {
      this.done.emit()
    }
  }
}
