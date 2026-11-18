import { Component, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideWallet } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { WalletService } from '@/core/wallet'
import { EmptyState } from '@/shared/components/empty-state'

/** Wallet rule 12: the current book has no wallet yet, so the tabs ask for the first one. */
@Component({
  selector: 'app-wallet-first-step',
  imports: [TranslocoPipe, NgIcon, HlmButton, EmptyState],
  providers: [provideIcons({ lucideWallet })],
  templateUrl: './wallet-first-step.html',
})
export class WalletFirstStep {
  protected walletService = inject(WalletService)
}
