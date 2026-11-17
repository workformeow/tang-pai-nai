export type ShareRole = 'editor' | 'viewer'

/** A pending invitation (`wallet_invites`); times are epoch ms. */
export interface Invite {
  id: string
  bookId: string
  ownerId: string
  email: string
  role: ShareRole
  walletIds: string[]
  createdAt: number
  expiresAt: number
  lastSentAt: number
}

export type NewInvite = Omit<Invite, 'id'>

export interface UserRef {
  id: string
  email: string
  displayName: string
  /** Only a verified email matches invitations (rule 6). */
  emailVerified: boolean
  /** A demo account (demo rule 9: it can't share). */
  isDemo?: boolean
}

/** A live wallet as sharing needs it. */
export interface WalletRef {
  id: string
  bookId: string
  ownerId: string
  name: string
  icon: string
  color: string
  currencyCode: string
  initialBalance: number
  isArchived: boolean
  sortOrder: number
}

/** One `wallet_members` row of a book, with the member's name. */
export interface MemberRow {
  userId: string
  displayName: string
  email: string
  role: ShareRole
  walletId: string
  addedAt: number
}

/** One wallet shared with the caller (live, open, on a live book). */
export interface ShareRow {
  role: ShareRole
  wallet: WalletRef
}

/** A book as the switcher shows it. */
export interface BookRef {
  id: string
  name: string
  icon: string
  color: string
}

/** A synced row as `/sync/pull` answers it (camelCase, no `userId`). */
export type RowData = Record<string, unknown>
