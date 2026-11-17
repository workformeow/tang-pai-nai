import { Component, computed, input } from '@angular/core'
import { currencyFlagUrl } from './currency-flags'

/**
 * A currency's flag (docs/features/currency.md → Web screens), decorative: the code or name
 * beside it says which currency. A static SVG from `public/flags/`, never in a bundle; a code
 * without a flag gets a plain muted shape. Size it with a class on the host (`size-10`,
 * `h-3 w-4`).
 */
@Component({
  selector: 'app-currency-flag',
  template: `
    @if (url(); as src) {
      <img class="size-full object-cover" alt="" [src]="src" />
    }
  `,
  host: {
    'aria-hidden': 'true',
    class: 'inline-block shrink-0 overflow-hidden bg-muted ring-1 ring-border',
    '[class.rounded-full]': "shape() === 'round'",
    '[class.rounded-sm]': "shape() === 'rect'",
  },
})
export class CurrencyFlag {
  code = input.required<string>()
  shape = input<'round' | 'rect'>('rect')

  protected url = computed(() => currencyFlagUrl(this.code(), this.shape()))
}
