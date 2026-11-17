import type { FormControl, FormGroup } from '@angular/forms'

export interface BookFormControls {
  name: FormControl<string>
  icon: FormControl<string>
  color: FormControl<string>
}
export type BookFormGroup = FormGroup<BookFormControls>
export type BookFormValue = ReturnType<BookFormGroup['getRawValue']>
