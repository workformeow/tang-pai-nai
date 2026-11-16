# Shared activity

> Status: **built** (#21, 2026-11). Web only: `core/transaction` (`activity.ts`, the query, the
> scope and the names), `core/sharing` (`loadOwner` feeds the scope), `features/transactions` (the
> page) and `layout/transactions-header` (the ⋮ entry). No API change (rule 12). Builds on
> [sharing.md](sharing.md) rules 9, 12 and 15. Mock-up: the owner's design canvas "Shared Activity"
> (five screens, agreed 2026-11).

## Purpose

In a shared book (a trip's "กองกลาง", a household wallet), everyone in the share can see **who
added, edited or deleted which transaction**. Before this the owner saw "เพิ่มโดย …" on rows a
member added, but nobody saw who edited a row last, and a deleted row simply disappeared.

The activity comes from what every transaction already carries: `addedBy`, `updatedBy`
(set by the server on every write, sharing rule 12), `createdAt`, `updatedAt` and `deletedAt`
(a deleted row stays as a tombstone for 90 days). Nothing new is stored.

## Out of scope

- **A full history of every change** ("500 → 450 → 480"). Only the **latest** action on each row
  shows (rule 4). A full history needs the server: it is the only place that sees every write
  (backlog, see ROADMAP: kept 30 days, read online).
- **History kept on the device.** A device only sees a row's state at each pull, so edits between
  two pulls are lost, each device would hold a different history, a new device would hold none,
  and a member keeps nothing (a shared book lives in memory only, offline-sync rule 15).
- **Restoring** a row someone else deleted from the activity page (backlog).
- Activity of anything but transactions: transfers, debts, events and recurring rules are not
  shared (sharing.md, out of scope).
- Notifications about activity (live-sync.md, decided against).

## Business rules

**What shows**

1. The activity of a book lists the **transactions of its shared wallets** whose `updatedAt`
   is within the **last 90 days** (the server's tombstone retention), deleted ones included,
   newest first.
   - A **member** (editor or viewer) sees every wallet of the shared book in use: they are
     all shared with them.
   - The **owner** sees the wallets shared with at least one member, as read online
     (`GET /sharing/books/:id`, kept in memory), **plus** any wallet holding a row whose latest
     action someone else did in the last 90 days. That second part works offline before the
     read, and keeps the activity after the sharing ends (rule 8).
   - The owner's private wallets of that book never show.
2. Everyone in the share sees the same activity, the owner's own actions included.
3. Each line is one transaction: **who** (an initial in a circle, **one colour per person**),
   **what**, the category, the amount with its sign, the note, its wallet and the time.

**Who and what**

4. The action is the row's latest:
   - **ลบ** (deleted): `deletedAt` is set. Who = `updatedBy`.
   - **เพิ่ม** (added): never changed after it was created, i.e. `updatedAt` is within 1 minute of
     `createdAt`. Who = `addedBy` (`null` = the owner).
   - **แก้ไข** (edited): any other row, a restored one too. Who = `updatedBy`.
     An edit within a minute of the add reads as an add; that is accepted. A row this device
     wrote and the server hasn't answered yet (pending, or no `updatedBy`) is yours.
5. Names: yourself = **"คุณ"**; anyone else = their display name from the share's people
   (sharing rule 9 for a member, the owner's member list for the owner); someone no longer in
   the share = **"อดีตสมาชิก"** (also used by sharing rule 15), drawn in a grey circle.

**On the transaction list**

6. A row shows **who touched it, when that is not you** (one line, no change to rows you wrote
   yourself):
   - last edited by someone else → "แก้ไขโดย <name>";
   - otherwise added by someone else → "เพิ่มโดย <name>".
     This replaces sharing rule 15's "เพิ่มโดย" (owner only): a member now also sees "เพิ่มโดย
     <owner>" on the owner's rows. A book nobody shares shows no names.

**Where and when**

7. The page opens from the Transactions tab's **⋮ menu** ("กิจกรรม", **after "รายการซ้ำ"**),
   shown while the current book has any activity scope: a shared book in use (member), or an
   own book with a shared wallet or a row someone else touched in the last 90 days (rule 1).
8. **Sharing ended** (the owner's read says the book has no members any more): the activity
   stays until the last line someone else wrote is 90 days old, then the ⋮ entry goes by itself.
   - In its last **7 days** the ⋮ entry shows **"เหลือ n วัน"** on the right, and on the last
     day **"วันนี้วันสุดท้าย"**.
   - The page shows a line on top: **"สมุดนี้หยุดแชร์แล้ว"** and **"ดูกิจกรรมได้ถึง <date>"**,
     with "(เหลือ n วัน)" in the last 7 days.
   - While the book is still shared there is no such line and no count: old lines simply drop
     off one by one at 90 days. A member who was removed can't open the book any more
     (sharing rule 15), so this is the owner's only.
9. The owner's activity works **offline** (their local database); only names and the shared
   wallets need one online read (rules 1 and 5), done once per book per app session by the
   Transactions tab and by the page. A member's works while the shared book is in use, which
   is online only (sharing rule 10).
10. The page follows the data: a sync round, a shared-book refresh or a live poke (#20)
    updates it like the transaction list.

**Opening a line**

11. A live row opens its transaction sheet, as on the list (an editor may edit it; a viewer reads
    it). A deleted row is not a button: its amount is struck through and grey.
12. Lines are drawn 100 at a time, grouped by the day of the action ("วันนี้ · …", "เมื่อวาน · …").

**Data**

13. No API change: the owner's device already syncs `addedBy` and `updatedBy`, and a member's
    `GET /sharing/with-me/:id/rows` returns every column of a transaction, tombstones included.

## Web screens

Wording (owner, 2026-11: formal, short):

- **⋮ → กิจกรรม** (`/transactions/activity`, ‹ back to the Transactions tab): the header
  "กิจกรรม", a line under it **"การเปลี่ยนแปลงในกระเป๋าที่แชร์ 90 วันล่าสุด"**, then day groups.
  Each line: the person's initial in a circle of their colour, "**แม่** เพิ่ม · <category>", then
  "<note> · <wallet> · <time>", and the amount (income / expense colour; struck through and grey
  when deleted). Empty: **"ไม่มีการเปลี่ยนแปลงในช่วง 90 วัน"**.
- **Ended share**: rule 8's line on top of the page (a clock icon, the brand tint) and
  "เหลือ n วัน" in the ⋮ menu.
- **Transaction list**: rule 6's line under a row, in the place of the old "เพิ่มโดย".
- Both languages (en: "Activity", "Changes in shared wallets, last 90 days", "No changes in the
  last 90 days", "a former member", "This book is no longer shared", "Activity shows until …",
  "n days left", "Last day today").

## Interactions

- `core/transaction/activity.ts`: `latestAction` (rule 4, in TS) and `ACTOR_SQL` (the same in
  SQL), `ACTIVITY_MS`, `activityDaysLeft`, `activityLeftText`.
- `TransactionService`: `activityScope()` (rules 1, 7, 8: wallets, `ended`, `expiresAt`),
  `activity(scope)` (one SQL query over the local tables, TEMP shadows included for a shared
  book), `shares` / `setShares(bookId, walletIds, members)` (fed by `SharingService.loadOwner`),
  `people` (names, now also behind `updatedBy`). `Transaction.updatedBy` is read from the row.
- `features/transactions`: `pages/activity-page` (the page) and the list's `touchedBy` line.
- `layout/transactions-header`: the ⋮ entry and its "เหลือ n วัน".

## Decisions

- Decided with the owner (2026-11): everyone in the share sees it, the owner's actions included,
  latest action per row over 90 days, under ⋮ after รายการซ้ำ, names shown when not you, one
  colour per person, deleted rows only struck through, nothing new stored and no server history
  for now. After the sharing ends the activity stays until it is 90 days old (option ข), with
  the days left in the last week.
