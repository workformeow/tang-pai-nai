# Shared activity

> Status: **Spec** (#21). Nothing built yet. Web only: `core/transaction` (the query and the
> names), `features/transactions` (the page). No API change expected (rule 12). Builds on
> [sharing.md](sharing.md) rules 9, 12 and 15.

## Purpose

In a shared profile (a trip's "กองกลาง", a household wallet), everyone in the share can see **who
added, edited or deleted which transaction**. Today the owner sees "เพิ่มโดย …" on rows a member
added, but nobody sees who edited a row last, and a deleted row simply disappears: nobody knows
who removed it.

The activity comes from what every transaction already carries: `addedBy`, `updatedBy`
(set by the server on every write, sharing rule 12), `createdAt`, `updatedAt` and `deletedAt`
(a deleted row stays as a tombstone for 90 days). Nothing new is stored.

## Out of scope

- **A full history of every change** ("500 → 450 → 480"). Only the **latest** action on each row
  shows (rule 4). A full history needs the server: it is the only place that sees every write
  (backlog, see ROADMAP: kept 30 days, read online).
- **History kept on the device.** A device only sees a row's state at each pull, so edits between
  two pulls are lost, each device would hold a different history, a new device would hold none,
  and a member keeps nothing (a shared profile lives in memory only, offline-sync rule 15).
- **Restoring** a row someone else deleted from the activity page (backlog).
- Activity of anything but transactions: transfers, debts, events and recurring rules are not
  shared (sharing.md, out of scope).
- Notifications about activity (live-sync.md, decided against).

## Business rules

**What shows**

1. The activity of a profile lists the **transactions of its shared wallets** whose `updatedAt`
   is within the **last 90 days** (the server's tombstone retention, `RETENTION_MS`), deleted
   ones included, newest first.
   - A **member** (editor or viewer) sees every wallet of the shared profile in use: they are
     all shared with them.
   - The **owner** sees the wallets shared with at least one member, as read online
     (`GET /sharing/profiles/:id`, kept in memory). Offline, before that read, it falls back to
     the wallets holding a row someone else wrote (`addedBy` or `updatedBy` not the owner).
   - The owner's private wallets of that profile never show.
2. Everyone in the share sees the same activity, the owner's own actions included.
3. Each line is one transaction: **who**, **what**, the row (category, amount with its sign,
   note), its wallet and the time.

**Who and what**

4. The action is the row's latest:
   - **ลบ** (deleted): `deletedAt` is set. Who = `updatedBy`.
   - **เพิ่ม** (added): never changed after it was created, i.e. `updatedAt` is within 1 minute of
     `createdAt`. Who = `addedBy` (`null` = the owner).
   - **แก้ไข** (edited): any other row, a restored one too. Who = `updatedBy`.
     An edit within a minute of the add reads as an add; that is accepted.
5. Names: yourself = **"คุณ"**; anyone else = their display name from the share's people
   (sharing rule 9 for a member, the owner's member list for the owner); someone no longer in
   the share = **"สมาชิก"** (as sharing rule 15).

**On the transaction list**

6. A row of a shared wallet shows **who touched it, when that is not you** (one line, no change
   to rows you wrote yourself):
   - last edited by someone else → "แก้ไขโดย <name>";
   - otherwise added by someone else → "เพิ่มโดย <name>".
     This replaces sharing rule 15's "เพิ่มโดย" (owner only): a member now also sees "เพิ่มโดย
     <owner>" on the owner's rows. A profile nobody shares shows no names.

**Where and when**

7. The page opens from the Transactions tab's **⋮ menu** ("กิจกรรม"), shown only when the current
   profile is shared: a shared profile in use (member), or an own profile with at least one
   member (owner, rule 1).
8. The owner's activity works **offline** (their local database); only names and the shared
   wallets need one online read first (rules 1 and 5). A member's works while the shared profile
   is in use, which is online only (sharing rule 10).
9. The page follows the data: a sync round, a shared-profile refresh or a live poke (#20)
   updates it like the transaction list.

**Opening a line**

10. A live row opens its transaction sheet, as on the list (an editor may edit it; a viewer reads
    it). A deleted row is not a button: its line shows the last values it had.
11. Lines are drawn 100 at a time, grouped by day like the transaction list.

**Data**

12. No API change is expected: the owner's device already syncs `addedBy` and `updatedBy`, and
    a member's `GET /sharing/with-me/:id/rows` returns every column of a transaction. If
    `updatedBy` turns out to be missing there, adding it is part of this feature.

## Web screens

- **⋮ → กิจกรรม** (`/transactions/activity`, ‹ back to where it was opened): the header "กิจกรรม",
  a line under it ("การเพิ่ม แก้ไข และลบในกระเป๋าที่แชร์ ย้อนหลัง 90 วัน"), then day groups.
  Each line: the person's initial in a badge, "**แม่** เพิ่ม" / "แก้ไข" / "ลบ", the category,
  the amount (income / expense colour; struck through and muted when deleted), the wallet and
  the time. Empty: "ยังไม่มีกิจกรรมใน 90 วันที่ผ่านมา".
- **Transaction list**: rule 6's line under a row, in the place of today's "เพิ่มโดย".
- Both languages, as every screen (web/AGENTS.md → UI text).

## Interactions

- `core/transaction`: `TransactionService.activity(profileId, walletIds)` (one SQL query over the
  local tables, TEMP shadows included for a shared profile) and the names behind `addedBy` /
  `updatedBy` (today's `addPeople`, extended to `updatedBy`).
- `core/sharing`: which of the owner's wallets are shared, from the read it already does
  (`loadOwner`), and the people of a shared profile in use.
- `features/transactions`: the page and the ⋮ entry. It imports nothing from `core/sharing`
  directly beyond what the header already reads.

## Open questions

- None. Decided with the owner (2026-11): everyone in the share sees it, the owner's actions
  included, latest action per row over 90 days, under ⋮, names shown when not you, nothing new
  stored and no server history for now.
