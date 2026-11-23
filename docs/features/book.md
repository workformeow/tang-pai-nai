# Book

> Status: **Built** in #6.1; wallets joined in #6.2 (delete takes them, rule 8). API:
> `api/src/features/book/` (sync handler only). Web: `core/book` (`BookService`),
> `layout/` (switcher, book sheet, create step) and `features/account/pages/books-page`.
> Categories joined in #7.1 (a new book comes with the default set; delete takes them).

## Purpose

A book keeps one area of a person's money apart from the others: "ส่วนตัว", "ครอบครัว",
"ร้านกาแฟ". Each book has its own wallets (#6.2), its own category set (#7) and therefore its
own transactions, reports and budgets. One user has any number of books and switches between
them from the header. Nothing is shared between books, and nothing is created for the user:
they make their first book, then its first wallet.

## Out of scope

- Sharing a book. Sharing works per wallet (#16, `wallet_members`); where a wallet shared
  with you shows up is an open question below.
- Totals or reports across books.
- A default currency or timezone per book (the wallet holds the currency).
- Wallets (#6.2) and categories (#7) themselves.

## Data model

`api/src/core/database/schema/book.ts`

- **books**: `id` (UUIDv7 from the device), `userId` (FK users, the owner), `name`, `icon`
  (a lucide name, e.g. `lucideHouse`), `color` (`#rrggbb`), `sortOrder` (integer ≥ 0), plus the
  sync columns (`createdAt`, `updatedAt`, `deletedAt?`, `changeSeq`, `updatedBy`; see
  [offline-sync.md](offline-sync.md)). Indexes (`userId`, `changeSeq`) and (`changeSeq`).
- Later tables point at it: `wallets.bookId` (#6.2), `categories.bookId` (#7).
  Transactions reach their book through the wallet.
- The device keeps the same table (`books`, snake_case) and the **current book per
  device** outside the database (rule 6).

## Business rules

1. Books are synced own data: each user sees and syncs only their own (another user's id is
   `ID_TAKEN` on push, never visible on pull). There is no REST endpoint; the web app writes them
   locally and they travel through `/sync/push` and `/sync/pull`.
2. `name` is 1–30 characters after trimming, and **unique among the user's live books**
   (case-insensitive). The device checks what it knows; the server checks again (a book made
   offline on another device with the same name is `rejected` with `CONFLICT`).
3. `icon` is a lucide export name (`lucide` + PascalCase, ≤ 40 characters). The web app offers a
   curated set and shows a default icon for a name it doesn't know, so the server only checks the
   shape. `color` is `#` + 6 lowercase hex digits; the web app offers a fixed palette (10 colours,
   4 shades each since 2026-11) and draws the glyph white or black for contrast (DESIGN.md §3
   User colours).
4. A user has at most **20 live books** (server check, `CONFLICT`; the web app hides "add" at
   20).
5. **No automatic book.** A new user (or a user whose books are all deleted) has none, and
   the app's data tabs show the "create book" step (Web screens). Creating the first book
   makes it current; the next step is its first wallet (#6.2).
6. **Current book per device**: the id is kept in `localStorage` under `tpn-book:<userId>`
   (in `sessionStorage` only when the local database is kept in memory, offline-sync rule 1). It isn't synced, so two devices may show different books.
   Opening the app shows that book if it is still live, else the first by order (rule 7), else
   the create step. Wiping the local data removes the key.
7. Order: `sortOrder` ascending, then `createdAt`, then `id`. A new book goes last
   (`max + 1`). Reordering writes `sortOrder` on each book whose position changed (one op per
   row, the usual later-edit-wins on conflict).
8. **Delete** is a soft delete after a confirm sheet (no undo: from #6.2 it removes the book's
   wallets, from #7.1 its categories, and from #8 its transactions too, as tombstones in the **same local write**, because the server
   runs no rule check on a delete, offline-sync rule 10). The last book may be deleted; the
   app then shows the create step. Deleting the current book switches to the first remaining
   one.
9. A book deleted on another device disappears on the next pull; if it was current here, the
   device switches as in rule 8 and says so in a toast. Delete beats edit (offline-sync rule 12).
10. Books are written offline like everything else. Only a device whose browser storage refused the local database (offline-sync rule 1) creates, edits and
    deletes them only while online; offline the form says so and its save is disabled.

## Endpoints

None of its own. Rows travel through the sync endpoints as table `books`:

| Method | Path         | Auth   | What                                         |
| ------ | ------------ | ------ | -------------------------------------------- |
| GET    | `/sync/pull` | Bearer | `books` rows with the other synced rows   |
| POST   | `/sync/push` | Bearer | upsert / delete ops on `books` (rule 1–4) |

The row shape is in OpenAPI (`SyncBookRow`).

## Web screens

Glossary: สมุด / Book (DESIGN.md §11).

- **Create step** (rule 5): the Transactions tab shows an empty state "สร้างสมุดแรก" with one
  line on what a book is and a "สร้างสมุด" button that opens the book form. The Wallets
  and Reports tabs show the same empty state, and the ➕ button goes to the Transactions tab
  while there is no book.
- **No wallet yet**: once a book exists, the Transactions and Wallets tabs show the
  first-wallet step (wallet rule 12, #6.2).
- **Book form** (a compact sheet, DESIGN.md §6; reworked in #6.2): the icon on its colour and
  the name on one row; tapping the icon opens an "ไอคอนและสี" view (colour swatches, the curated
  lucide grid; picking an icon goes back). Save is the one button at the bottom; in edit mode a
  trash icon in the header leads to the delete confirm view, which says how many wallets and
  categories go with the book (categories from 7.2). Used for create and edit; "fix" of
  a rejected book op opens it with the refused values (`FIX_ROUTES` →
  `/account/books?fix=<opId>`). Closing never asks: unsaved input goes with the sheet.
- **Book switcher** (decided at the start of #6.1): on the Transactions, Wallets and Reports
  tabs the header's left side shows the current book: one glass capsule with its icon and a
  ▾, the same on every tab (owner, 2026-11; the name was there on the Wallets tab only, and the
  header changed shape between tabs). The Wallets tab shows its title in the centre. Tapping it opens a sheet: the books in order with a check on the current one, "จัดการ
  สมุด" as a header icon and "เพิ่มสมุด" (hidden at 20) as the sheet's button. The Account tab keeps its page title.
- **Account › สมุด** `/account/books`: the list in order (icon, name, "รอ sync" on a
  pending row). Tap a row to edit it in the form, whose header trash icon ("ลบสมุด") opens
  the confirm view naming the book and how many wallets (and from #8 transactions) go with
  it. "จัดลำดับ" switches the list to an order mode with one grip handle per row (decided
  while building 6.1): press and hold it (~0.3 s on touch, at once with a mouse), then drag;
  the handle also moves its row with the ↑ / ↓ keys (DESIGN.md §8).

## Interactions

- **Wallet (#6.2)**: `wallets.bookId` (required); a wallet push is rejected when its book
  isn't the user's live book. The Wallets tab lists the current book's wallets.
- **Category (#7)**: one category set per book, `categories.bookId`; a wallet can hide
  categories it doesn't use. The default set is written **by the device that creates the
  book**, in the same local write as the book (decided at the start of #6.1, so two
  devices never seed one book twice; built in #7.1, in the app's language).
  A refused book create refuses its categories and first wallet too; the sync sheet shows
  them under the book (category rule 12).
- **Transaction (#8)**, reports, budgets: filtered by the current book through its wallets.
- **Offline sync**: `books` is a pushable synced table (`core/sync` handler, the reference
  for `wallets`; device schema step + `SYNC_TABLES` entry).

## Open questions

- (Decided in #16.2, replacing 16.1's Wallets tab section: books shared with you are a
  "แชร์กับฉัน" group in the switcher, online only: [sharing.md](sharing.md) rule 10.)
