import type {
  Invite,
  MemberRow,
  NewInvite,
  BookRef,
  RowData,
  ShareRole,
  ShareRow,
  UserRef,
  WalletRef,
} from './sharing.entity'

/**
 * Port: what the sharing service needs from storage (docs/features/sharing.md). Reads other
 * features' tables through `@/core/database/schema`. Missing rows answer `null` / `[]`.
 */
export interface SharingRepository {
  transaction<T>(work: (repo: SharingRepository) => Promise<T>): Promise<T>

  findUser(id: string): Promise<UserRef | null>
  findUserByEmail(email: string): Promise<UserRef | null>
  /** The live book `bookId` when `userId` owns it. */
  ownsBook(userId: string, bookId: string): Promise<boolean>
  /** Live wallets of a book (archived too), in the owner's order. */
  bookWallets(bookId: string): Promise<WalletRef[]>
  /** Live, open wallets among `ids` (on live books). */
  openWallets(ids: string[]): Promise<WalletRef[]>

  /** `wallet_members` rows on the live wallets of a book. */
  membersOf(bookId: string): Promise<MemberRow[]>
  /** Replaces `userId`'s rows on the book's wallets with `walletIds` (none = removed). */
  setMembership(
    bookId: string,
    userId: string,
    role: ShareRole,
    walletIds: string[],
    at: number
  ): Promise<void>
  /** Wallets shared with `userId` that are live, open and on a live book. */
  sharesOf(userId: string): Promise<ShareRow[]>
  /** `userId`'s role on a wallet visible to them (rule 8), with the wallet. */
  shareOf(userId: string, walletId: string): Promise<ShareRow | null>

  invitesOf(bookId: string, now: number): Promise<Invite[]>
  invitesTo(email: string, now: number): Promise<Invite[]>
  findInvite(id: string, now: number): Promise<Invite | null>
  findInviteTo(bookId: string, email: string, now: number): Promise<Invite | null>
  createInvite(invite: NewInvite): Promise<Invite>
  markSent(id: string, at: number): Promise<void>
  deleteInvite(id: string): Promise<void>
  deleteExpiredInvites(now: number): Promise<void>

  /** Balances of live wallets: initial + transactions ± transfers ± debt entries. */
  balances(walletIds: string[]): Promise<Map<string, number>>
  /** Per wallet, the signed sum of its live transfer sides and debt entries (rule 9). */
  otherMoney(walletIds: string[]): Promise<Map<string, number>>
  /** A live book's name, icon and colour. */
  findBook(bookId: string): Promise<BookRef | null>
  /** The wallets as pull answers them, in the owner's order. */
  walletRows(walletIds: string[]): Promise<RowData[]>
  /** The book's live categories as pull answers them (archived too). */
  categoryRows(bookId: string): Promise<RowData[]>
  /** The wallets' transactions with `changeSeq > since`, tombstones included, by `changeSeq`. */
  transactionRows(walletIds: string[], since: number, limit: number): Promise<RowData[]>

  /** Counts one hit in a fixed window (`rate_limit_buckets`). */
  hitRateLimit(
    key: string,
    windowMs: number,
    at: number
  ): Promise<{ count: number; windowStart: number }>
}
