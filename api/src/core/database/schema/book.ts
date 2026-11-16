import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { syncColumns } from '@/core/database/columns'
import { users } from '@/core/database/schema/auth'

// docs/features/book.md → Data model. A synced table: the id comes from the device, rows travel
// through /sync/push and /sync/pull, and "delete" is a tombstone.
export const books = sqliteTable(
  'books',
  {
    id: text().primaryKey(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    icon: text().notNull(),
    color: text().notNull(),
    sortOrder: integer().notNull(),
    ...syncColumns,
  },
  (table) => [
    index('books_user_seq_idx').on(table.userId, table.changeSeq),
    index('books_change_seq_idx').on(table.changeSeq),
  ]
)
