import { Component, computed, inject, model } from '@angular/core'
import { Router } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideRefreshCw } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { AuthStore } from '@/core/auth'
import { BOOK_TABLE, BookService } from '@/core/book'
import { CategoryService } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { LiveService } from '@/core/live'
import { NetworkStatusService } from '@/core/network'
import { SyncService } from '@/core/offline'
import type { OutboxOp, SyncRow } from '@/core/offline'
import { WALLET_TABLE, WalletService } from '@/core/wallet'
import { SheetFrame } from '@/shared/components/sheet'
import { formatAmount } from '@/shared/utils'

/** Where "fix" opens a rejected op's values, per table. */
const FIX_ROUTES: Readonly<Record<string, string>> = {
  books: '/account/books',
  categories: '/account/categories',
  // The wallet sheet lives in the shell, so it opens on the tab itself (even its first-wallet step).
  [WALLET_TABLE]: '/wallets',
  transactions: '/transactions',
  transfers: '/transactions',
  // The rule's sheet opens from the rules page, which reads its kind (recurring.md).
  recurring_rules: '/account/recurring',
  // The debts page opens a debt's or an entry's sheet with the refused values (debt.md).
  debts: '/wallets/debts',
  debt_entries: '/wallets/debts',
  // The events page opens the event sheet with the refused values (event.md).
  events: '/transactions/events',
}

/**
 * The sync sheet the header pill opens (offline-sync → Web screens): the last sync, "sync now",
 * rejected ops (fix or discard) and conflict notices. Loaded on first open, so the drawer code
 * stays out of the initial bundle.
 */
@Component({
  selector: 'app-sync-sheet',
  imports: [TranslocoPipe, NgIcon, HlmButton, HlmSpinner, HlmDrawerImports, SheetFrame],
  providers: [provideIcons({ lucideRefreshCw })],
  templateUrl: './sync-sheet.html',
})
export class SyncSheet {
  private router = inject(Router)
  private walletService = inject(WalletService)
  private categoryService = inject(CategoryService)
  private languageService = inject(LanguageService)
  protected syncService = inject(SyncService)
  protected liveService = inject(LiveService)
  private bookService = inject(BookService)
  private transloco = inject(TranslocoService)
  protected networkStatusService = inject(NetworkStatusService)
  protected authStore = inject(AuthStore)

  open = model(false)

  /**
   * Rejected ops to show: a refused book create carries its refused child rows (category rule
   * 12), which are listed under it rather than one by one.
   */
  /**
   * Rejected ops to show: a refused book create carries its refused child rows (category rule
   * 12), which are listed under it rather than one by one.
   */
  protected shown = computed<{ op: OutboxOp; withText: string | null }[]>(() => {
    this.languageService.language()
    return this.bookService.rejectedItems().map(({ op, children }) => {
      if (children.length === 0) {
        return { op, withText: null }
      }
      const count = (table: string) => children.filter((child) => child.table === table).length
      const parts = [
        count('categories') > 0
          ? this.transloco.translate('sync.withCategories', { count: count('categories') })
          : null,
        count(WALLET_TABLE) > 0
          ? this.transloco.translate('sync.withWallets', { count: count(WALLET_TABLE) })
          : null,
        count('transactions') + count('transfers') > 0
          ? this.transloco.translate('sync.withTransactions', {
              count: count('transactions') + count('transfers'),
            })
          : null,
        count('debts') > 0
          ? this.transloco.translate('sync.withDebts', { count: count('debts') })
          : null,
      ].filter((part) => part !== null)
      return {
        op,
        withText: this.transloco.translate('sync.withChildren', {
          items: parts.join(this.transloco.translate('sync.and')),
        }),
      }
    })
  })

  protected discard(opId: string, table: string): void {
    if (table === BOOK_TABLE) {
      this.bookService.discardRefused(opId)
      return
    }
    this.syncService.discard(opId)
  }

  protected time(at: number): string {
    return new Intl.DateTimeFormat(this.languageService.locale(), {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(at)
  }

  protected summary(row: SyncRow): string {
    const title = row['title'] ?? row['name'] ?? row['person']
    if (typeof title === 'string') {
      return title
    }
    // A debt entry: what it is and its amount (debt → Web screens).
    if (
      typeof row['debtId'] === 'string' &&
      typeof row['kind'] === 'string' &&
      !row['categoryId']
    ) {
      const wallet =
        typeof row['walletId'] === 'string' ? this.walletService.byId(row['walletId']) : null
      const minorUnit = this.walletService.minorUnit(wallet?.currencyCode ?? '')
      const parts = [
        this.transloco.translate(
          row['kind'] === 'principal' ? 'debts.principalShort' : 'debts.repaymentShort'
        ),
        typeof row['amount'] === 'number'
          ? formatAmount(row['amount'], minorUnit, this.languageService.locale())
          : '',
        typeof row['note'] === 'string' ? row['note'] : '',
      ]
      return parts.filter((part) => part).join(' · ')
    }
    // A transfer (or a transfer recurring rule): its two wallets and amount (and note).
    const fromId = row['kind'] === 'transfer' ? row['walletId'] : row['fromWalletId']
    if (typeof fromId === 'string' && typeof row['toWalletId'] === 'string') {
      const from = this.walletService.byId(fromId)
      const to = this.walletService.byId(row['toWalletId'])
      const minorUnit = this.walletService.minorUnit(from?.currencyCode ?? '')
      const parts = [
        `${this.transloco.translate('transfers.title')} ${from?.name ?? ''} → ${to?.name ?? ''}`,
        typeof row['amount'] === 'number'
          ? formatAmount(row['amount'], minorUnit, this.languageService.locale())
          : '',
        typeof row['note'] === 'string' ? row['note'] : '',
      ]
      return parts.filter((part) => part).join(' · ')
    }
    // A transaction has no name: its category and amount (and note) say which one it is.
    if (typeof row['amount'] === 'number' && typeof row['categoryId'] === 'string') {
      const wallet =
        typeof row['walletId'] === 'string' ? this.walletService.byId(row['walletId']) : null
      const minorUnit = this.walletService.minorUnit(wallet?.currencyCode ?? '')
      const parts = [
        this.categoryService.byId(row['categoryId'])?.name,
        formatAmount(row['amount'], minorUnit, this.languageService.locale()),
        typeof row['note'] === 'string' ? row['note'] : '',
      ]
      return parts.filter((part) => part).join(' · ')
    }
    return String(row['id'])
  }

  protected fixRoute(table: string): string | undefined {
    return FIX_ROUTES[table]
  }

  protected fix(table: string, opId: string): void {
    if (table === WALLET_TABLE) {
      void this.router.navigate([FIX_ROUTES[table]]).then(() => this.walletService.openFix(opId))
      return
    }
    void this.router.navigate([FIX_ROUTES[table]], { queryParams: { fix: opId } })
  }

  /**
   * "Sync now": a round that leaves nothing to look at (no failure, nothing waiting, rejected or
   * noticed) closes the sheet; the list and the pill already show the result, so no toast.
   */
  protected syncNow(): void {
    void this.syncService.sync().then(() => this.closeIfDone())
  }

  private closeIfDone(): void {
    if (
      this.syncService.status() === 'synced' &&
      this.syncService.rejected().length === 0 &&
      this.syncService.notices().length === 0
    ) {
      this.open.set(false)
    }
  }
}
