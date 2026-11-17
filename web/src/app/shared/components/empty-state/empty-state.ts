import { Component, input } from '@angular/core'

/** Centred "nothing here yet" block. Project an icon in front of the text. */
@Component({
  selector: 'app-empty-state',
  templateUrl: './empty-state.html',
})
export class EmptyState {
  heading = input.required<string>()
  description = input('')
}
