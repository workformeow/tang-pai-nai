import { Component, input, output } from '@angular/core'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronLeft, lucideX } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'

/**
 * The inside of every bottom sheet (DESIGN.md §6 Bottom sheet): a header with close (X) or back
 * (‹) on the left in a glass disc (`tpn-glass`), the right-hand icons in one glass capsule, the title in the centre and icon actions on the right (`[sheetActions]`), a
 * body that scrolls, and the main action pinned at the bottom (`[sheetFooter]`). Put it in a
 * `hlm-drawer-content class="mx-auto h-[92dvh] w-full max-w-120
 * data-[vaul-drawer-direction=bottom]:max-h-[92dvh]"`: every sheet is the same near-full height,
 * so its main action always sits in the same place.
 */
@Component({
  selector: 'app-sheet-frame',
  imports: [NgIcon, HlmButton, HlmDrawerImports],
  providers: [provideIcons({ lucideChevronLeft, lucideX })],
  host: { class: 'flex min-h-0 flex-1 flex-col' },
  templateUrl: './sheet-frame.html',
})
export class SheetFrame {
  title = input.required<string>()
  /** X closes the sheet; ‹ goes back to the sheet's previous view. */
  leadingIcon = input<'close' | 'back'>('close')
  leadingLabel = input.required<string>()
  /**
   * How many header icons sit on the right (up to two by default; the category form has four:
   * move, archive, merge, delete): the right side takes their width and the title centres in
   * what is left, instead of running under them.
   */
  actions = input<2 | 3 | 4>(2)
  leading = output()
}
