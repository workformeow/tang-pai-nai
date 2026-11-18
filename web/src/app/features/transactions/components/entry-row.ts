import { Component, input, output } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArrowLeftRight,
  lucideCloud,
  lucideHandCoins,
  lucidePlane,
  lucideRepeat,
  lucideUsers,
} from '@ng-icons/lucide'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import type { EntryRow as Row } from '@/features/transactions/day-groups'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'

/**
 * A stored row in a day card of the Transactions tab (transaction.md → Web screens): a
 * transaction (its category, the repeat / debt / event marks), a side of a transfer, or a debt
 * entry; the wallet's badge on "ทุกกระเป๋า", who else touched it, and whether it waits for sync.
 */
@Component({
  selector: 'app-entry-row',
  imports: [TranslocoPipe, NgIcon, IconBadge],
  providers: [
    provideIcons({
      lucideArrowLeftRight,
      lucideCloud,
      lucideHandCoins,
      lucidePlane,
      lucideRepeat,
      lucideUsers,
    }),
  ],
  host: { class: 'block' },
  templateUrl: './entry-row.html',
})
export class EntryRow {
  row = input.required<Row>()
  /** Tapped: the page opens its form (or its debt's page). */
  opened = output()

  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON
}
