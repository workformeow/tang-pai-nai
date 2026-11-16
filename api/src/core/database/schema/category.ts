import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { syncColumns } from '@/core/database/columns'
import { users } from '@/core/database/schema/auth'
import { books } from '@/core/database/schema/book'
import type { AnySQLiteColumn } from 'drizzle-orm/sqlite-core'

// docs/features/category.md → Data model. A synced table like `wallets`: the id comes from the
// device, rows travel through /sync/push and /sync/pull, and "delete" is a tombstone.
export const categories = sqliteTable(
  'categories',
  {
    id: text().primaryKey(),
    /** The owner. */
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Cascade: purging a book's (or a parent's) old tombstone takes its categories' with it.
    bookId: text()
      .notNull()
      .references(() => books.id, { onDelete: 'cascade' }),
    type: text({ enum: ['income', 'expense'] }).notNull(),
    /** Null for a top-level category (one level only, category rule 3). */
    parentId: text().references((): AnySQLiteColumn => categories.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    icon: text().notNull(),
    color: text().notNull(),
    isArchived: integer({ mode: 'boolean' }).notNull(),
    sortOrder: integer().notNull(),
    /**
     * The category this one was merged into (category rule 15); only a tombstone carries it. No FK:
     * purging either row must never cascade into the other.
     */
    mergedIntoId: text(),
    ...syncColumns,
  },
  (table) => [
    index('categories_user_seq_idx').on(table.userId, table.changeSeq),
    index('categories_change_seq_idx').on(table.changeSeq),
    index('categories_book_idx').on(table.bookId),
    index('categories_parent_idx').on(table.parentId),
  ]
)
