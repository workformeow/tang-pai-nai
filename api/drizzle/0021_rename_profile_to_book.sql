-- Profiles are called books (สมุด) in the UI since 2026-11, and the code follows so "profile" can
-- mean the user. Renames in place (beta: the tables are empty, but this keeps any rows anyway).
-- SQLite rewrites the foreign keys that reference `profiles` and the indexes on renamed columns;
-- only the index names need a drop and create.
ALTER TABLE `profiles` RENAME TO `books`;
--> statement-breakpoint
DROP INDEX `profiles_user_seq_idx`;
--> statement-breakpoint
CREATE INDEX `books_user_seq_idx` ON `books` (`user_id`,`change_seq`);
--> statement-breakpoint
DROP INDEX `profiles_change_seq_idx`;
--> statement-breakpoint
CREATE INDEX `books_change_seq_idx` ON `books` (`change_seq`);
--> statement-breakpoint
ALTER TABLE `wallets` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `wallets_profile_idx`;
--> statement-breakpoint
CREATE INDEX `wallets_book_idx` ON `wallets` (`book_id`);
--> statement-breakpoint
ALTER TABLE `categories` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `categories_profile_idx`;
--> statement-breakpoint
CREATE INDEX `categories_book_idx` ON `categories` (`book_id`);
--> statement-breakpoint
ALTER TABLE `transactions` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `transactions_profile_idx`;
--> statement-breakpoint
CREATE INDEX `transactions_book_idx` ON `transactions` (`book_id`);
--> statement-breakpoint
ALTER TABLE `transfers` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `transfers_profile_idx`;
--> statement-breakpoint
CREATE INDEX `transfers_book_idx` ON `transfers` (`book_id`);
--> statement-breakpoint
ALTER TABLE `recurring_rules` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `recurring_rules_profile_idx`;
--> statement-breakpoint
CREATE INDEX `recurring_rules_book_idx` ON `recurring_rules` (`book_id`);
--> statement-breakpoint
ALTER TABLE `debt_entries` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `debt_entries_profile_idx`;
--> statement-breakpoint
CREATE INDEX `debt_entries_book_idx` ON `debt_entries` (`book_id`);
--> statement-breakpoint
ALTER TABLE `debts` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `debts_profile_idx`;
--> statement-breakpoint
CREATE INDEX `debts_book_idx` ON `debts` (`book_id`);
--> statement-breakpoint
ALTER TABLE `events` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `events_profile_idx`;
--> statement-breakpoint
CREATE INDEX `events_book_idx` ON `events` (`book_id`);
--> statement-breakpoint
ALTER TABLE `wallet_invites` RENAME COLUMN `profile_id` TO `book_id`;
--> statement-breakpoint
DROP INDEX `wallet_invites_profile_email_idx`;
--> statement-breakpoint
CREATE UNIQUE INDEX `wallet_invites_book_email_idx` ON `wallet_invites` (`book_id`,`email`);
