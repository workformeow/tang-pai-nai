import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'
import { id } from '@/core/database/columns'
import { users } from '@/core/database/schema/auth'
import { books } from '@/core/database/schema/book'

// docs/features/sharing.md → Data model. Server only, never synced: a pending invitation to the
// wallets of one book. Rows go away when answered, cancelled or past `expiresAt`.
export const walletInvites = sqliteTable(
  'wallet_invites',
  {
    id: id(),
    bookId: text()
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    ownerId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Trimmed and lower case, compared with the invitee's verified `users.email`. */
    email: text().notNull(),
    role: text({ enum: ['editor', 'viewer'] }).notNull(),
    /** The wallets of `bookId` the invite shares, as a JSON array of ids. */
    walletIds: text({ mode: 'json' }).$type<string[]>().notNull(),
    createdAt: integer().notNull(),
    expiresAt: integer().notNull(),
    lastSentAt: integer().notNull(),
  },
  (table) => [
    uniqueIndex('wallet_invites_book_email_idx').on(table.bookId, table.email),
    index('wallet_invites_email_idx').on(table.email),
    index('wallet_invites_expires_idx').on(table.expiresAt),
  ]
)
