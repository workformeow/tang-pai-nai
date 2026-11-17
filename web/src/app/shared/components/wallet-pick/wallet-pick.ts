import { Component, input, output } from '@angular/core'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck } from '@ng-icons/lucide'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import { formatMoney } from '@/shared/utils'

/** A wallet as the picker shows it, already formatted by the sheet. */
export interface WalletPickItem {
  id: string
  name: string
  icon: string
  color: string
  /** A line under the name ("ไม่รวมในยอดรวม"); `null` shows none. */
  note: string | null
  /** The balance, formatted; `null` shows none (the transaction form's picker). */
  balance: string | null
  /** The balance is below zero: it takes the expense colour. */
  negative: boolean
}

/** The wallet fields the picker reads (`Wallet` from `core/wallet` fits). */
export interface WalletPickSource {
  id: string
  name: string
  icon: string
  color: string
  currencyCode: string
  excludeFromTotal: boolean
}

/** The balance line and its words, from the sheet's services. */
export interface WalletPickMoney {
  balance: number
  minorUnit: number
  locale: string
  /** The note of a wallet left out of the total (`wallets.excluded`). */
  excluded: string
}

/** A picker row: with `money`, the balance and the "left out" note; without, the name only. */
export const walletPickItem = (
  wallet: WalletPickSource,
  money?: WalletPickMoney
): WalletPickItem => ({
  id: wallet.id,
  name: wallet.name,
  icon: wallet.icon,
  color: wallet.color,
  note: money && wallet.excludeFromTotal ? money.excluded : null,
  balance: money
    ? formatMoney(money.balance, wallet.currencyCode, money.minorUnit, money.locale)
    : null,
  negative: (money?.balance ?? 0) < 0,
})

/**
 * A sheet view listing wallets to pick one (DESIGN.md §6): badge, name, an optional note and
 * balance, a check on the chosen one. One list for the transaction, transfer and debt sheets.
 * `empty` replaces the list when there is no wallet to show.
 */
@Component({
  selector: 'app-wallet-pick',
  imports: [NgIcon, IconBadge],
  providers: [provideIcons({ lucideCheck })],
  templateUrl: './wallet-pick.html',
})
export class WalletPick {
  protected walletIcon = WALLET_DEFAULT_ICON

  wallets = input.required<readonly WalletPickItem[]>()
  chosen = input<string | null>(null)
  /** The line shown instead of an empty list; empty keeps the (empty) list. */
  empty = input('')
  picked = output<string>()
}
