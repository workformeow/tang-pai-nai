import { inject } from '@angular/core'
import { toSignal } from '@angular/core/rxjs-interop'
import { NavigationEnd, Router } from '@angular/router'
import { filter, map } from 'rxjs'

/** The tabs that show a book's data: the switcher and the create step live there. */
const BOOK_TABS = ['/transactions', '/wallets', '/reports']

/** The tabs that need a wallet: the first-wallet step lives there (wallet rule 12). */
const WALLET_TABS = ['/transactions', '/wallets']

const under = (tabs: readonly string[], url: string): boolean =>
  tabs.some((tab) => url === tab || url.startsWith(`${tab}/`) || url.startsWith(`${tab}?`))

/** A book tab's URL. e.g. `isBookTab('/wallets/debts')` → `true`, `isBookTab('/account')` → `false` */
export const isBookTab = (url: string): boolean => under(BOOK_TABS, url)

/**
 * A tab that needs a wallet.
 * e.g. `isWalletTab('/transactions?fix=1')` → `true`, `isWalletTab('/reports')` → `false`
 */
export const isWalletTab = (url: string): boolean => under(WALLET_TABS, url)

/** The current URL as a signal (call in an injection context). */
export const currentUrl = () => {
  const router = inject(Router)
  return toSignal(
    router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects)
    ),
    { initialValue: router.url }
  )
}

/**
 * The Reports tab's own page, headed like the Transactions tab (report.md).
 * e.g. `isReportsTab('/reports?unit=year')` → `true`, `isReportsTab('/reports/currencies')` → `false`
 */
export const isReportsTab = (url: string): boolean => url.split(/[?#]/)[0] === '/reports'

/**
 * The Transactions tab's own page, whose header holds the wallet switcher (#8).
 * e.g. `isTransactionsTab('/transactions#top')` → `true`
 */
export const isTransactionsTab = (url: string): boolean => url.split(/[?#]/)[0] === '/transactions'

/**
 * The all-currencies report page (#24), whose header holds the Reports tab's "ดูตาม".
 * e.g. `isReportCurrencies('/reports/currencies')` → `true`
 */
export const isReportCurrencies = (url: string): boolean =>
  url.split(/[?#]/)[0] === '/reports/currencies'
