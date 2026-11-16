/** A book as the device stores it (docs/features/book.md → Data model). */
export interface Book {
  id: string
  name: string
  /** A lucide export name, e.g. `lucideHouse`. */
  icon: string
  /** `#rrggbb`. */
  color: string
  sortOrder: number
  createdAt: number
  updatedAt: number
  deletedAt: number | null
  /** Null until the server has seen the row. */
  changeSeq: number | null
}

/** What the book form edits. */
export interface BookValues {
  name: string
  icon: string
  color: string
}

/** Which book sheet is open: create, edit one, or "fix" a rejected op's refused values. */
export type BookSheetState =
  | { mode: 'create' }
  | { mode: 'edit'; id: string }
  | { mode: 'fix'; opId: string; id: string; values: BookValues }

export const BOOK_TABLE = 'books'

export const BOOK_LIMITS = {
  NAME_MAX: 30,
  /** Live books per user (book rule 4). */
  PER_USER: 20,
} as const

/** Where the device keeps its current book (book rule 6). */
export const BOOK_KEY_PREFIX = 'tpn-book:'

/**
 * Device tables whose rows carry `book_id` and go with their book (book rule 8). Their
 * tombstones are written in the same local write as the book's.
 */
export const BOOK_CHILD_TABLES = [
  'wallets',
  'categories',
  // A debt before what points at it (its entries, linked transactions and rules: outbox order).
  'debts',
  'debt_entries',
  // An event before the transactions tagged to it.
  'events',
  'transactions',
  'transfers',
  'recurring_rules',
] as const

/** The device table of categories, which a new book is written with (category rule 8). */
export const DEFAULT_CATEGORY_TABLE = 'categories'

/**
 * A book shared with the signed-in user, in use (docs/features/sharing.md rules 9–11): its rows
 * are in the database's TEMP tables while `status` is `ready`.
 */
export interface SharedBook {
  book: Book
  role: 'editor' | 'viewer'
  owner: { id: string; displayName: string }
  status: 'loading' | 'ready'
}
