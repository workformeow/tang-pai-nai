import { Component, input, output } from '@angular/core'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideArrowLeftRight, lucideHandCoins, lucideRepeat } from '@ng-icons/lucide'
import { CATEGORY_DEFAULT_ICON } from '@/core/category'
import type { UpcomingRow as Row } from '@/features/transactions/day-groups'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import type { UserIcon } from '@/shared/components/icon-badge'

/**
 * A recurring occurrence not recorded yet, in a day card of "อนาคต" (recurring rule 17): faded,
 * a dashed badge; tapping it opens its rule.
 */
@Component({
  selector: 'app-upcoming-row',
  imports: [NgIcon, IconBadge],
  providers: [provideIcons({ lucideArrowLeftRight, lucideHandCoins, lucideRepeat })],
  host: { class: 'block' },
  templateUrl: './upcoming-row.html',
})
export class UpcomingRow {
  row = input.required<Row>()
  /** Tapped: the page opens the rule. */
  opened = output()

  protected categoryIcon = CATEGORY_DEFAULT_ICON as UserIcon
  protected walletIcon = WALLET_DEFAULT_ICON
}
