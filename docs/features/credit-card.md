# Credit card

> Status: **Built** in #18 (agreed with the owner, mock-up `docs/features/mockups/credit-card.html`).
> Builds on [wallet.md](wallet.md) and [transfer.md](transfer.md). API: a column on `wallets`
> (`features/wallet`). Web: `core/wallet`, the Wallets tab, `layout/wallet-sheet`,
> `layout/transfer-sheet`, the Transactions tab.

## Purpose

A credit card is a wallet whose money isn't yours yet: a purchase on it is an expense **when you
buy** (in its real category), but the money leaves your total **when you pay the bill**. Before
this feature the owner kept the card out of the total (`excludeFromTotal`) and paid it with two
rows (an expense "ชำระบัตร" in the debit wallet + an income in the card), so the reports showed
one "ชำระบัตร" lump in the month of the payment instead of food, shopping, … in the month of the
purchase. A wallet marked **credit card** stays out of the total but counts in "ทุกกระเป๋า", and
a bill is paid with **one transfer** from a counted wallet to the card.

## Out of scope

- Statement cycles: a cut-off day, "this bill's amount", a due date and its reminder. Phase 2;
  phase 1 offers the whole amount owed and the user may change it.
- A credit limit, interest, minimum payment.
- Instalment plans on a card: a debt with "นับตอนผ่อนคืน" ([debt.md](debt.md)), as today.
- Turning old "ชำระบัตร" expenses + card incomes into transfers (Q3: left as they are; the user
  may edit them by hand).
- A wallet **type** (wallet.md → Out of scope stays): this is one flag, not a type.

## Data model

- **wallets.isCreditCard** (boolean, not null, default `false`; migration `0020`): the wallet is a
  credit card. Synced with the wallet row (`SyncWalletRow.isCreditCard`). A push without the field
  (a device from before this feature) means `false`.
- Nothing else is stored. The amount owed and the pay sheet's defaults are computed.

## Business rules

1. **A card is out of the total.** `isCreditCard = true` requires `excludeFromTotal = true`
   (server check in the row schema, `VALIDATION`; the form switches it on and locks it). Wallet
   rule 7 (the total) doesn't change: a card's balance never adds to ยอดรวม.
2. **A card counts in "ทุกกระเป๋า".** Transaction rule 11's and report rule 2's "all wallets" =
   the profile's wallets with `excludeFromTotal = false` **or** `isCreditCard = true` (archived
   ones included). So a purchase counts in the month's รายจ่าย and the reports by category on the
   day it was made, and a payment (a transfer from a counted wallet to the card) has both sides in
   view, so it adds nothing to รายรับ / รายจ่าย or the summary's "โอน" line.
   A report's balances (report rule 9) then include the cards' (negative) balances: the start and
   end of a period are "money − card debt", which keeps end − start = net + transfers.
3. **Amount owed** ("ค้างจ่าย") of a card = −balance when its balance (transaction rule 12) is
   below 0, else 0. A card paid above what it owes simply has a positive balance (no special
   line).
4. **Paying a card** is an ordinary transfer (transfer.md) to the card. The **pay sheet** is the
   transfer sheet opened with the card as the destination (fixed), the amount owed as the amount
   (editable), the source the last wallet this card was paid from (remembered on the device per
   card), else the first open counted wallet of the card's currency. Nothing else differs: same
   rules, same row, same undo.
5. **Transfer sheet** (opened any other way): when the destination is a card that owes money, a
   chip "ใช้ยอดค้าง <amount>" under the amount fills the amount owed in.
6. **Wallets tab**: open cards leave the wallet list for their own section **บัตรเครดิต (n)**
   under the actions, each with its amount owed (expense colour) and a **ชำระ** button while it
   owes something; the heading's right side shows the total owed per currency. Under ยอดรวม a
   small line "หลังหักหนี้บัตร <total − owed>" per currency, only while a card owes money (Q1).
   Archived cards go to the archived group like any wallet. Reorder mode keeps one order for all
   wallets (`sortOrder`); the sections show them in that order.
7. **Transactions tab, one card in view**: the header's figure is labelled "ค้างจ่าย" (the
   amount owed) instead of the balance, and a banner above the list "ยอดค้าง <amount>" with a
   **ชำระบัตร** button opens the pay sheet, while the card owes money.
8. **Turning the flag on or off** is allowed at any time (it changes only which view counts the
   card's rows). Turning it off leaves `excludeFromTotal` on (the user switches it off if they
   want).
9. **Shared wallets** (#16): a member sees the card like any shared wallet; it counts in no total
   of theirs (sharing rule as today). The server sends a member `isCreditCard: false`, so the
   member gets no card section, banner or pay sheet.

## Endpoints

None: the column travels through `/sync/push` and `/sync/pull` (`SyncWalletRow`).

## Web screens

- **Wallet form**: a **บัตรเครดิต** switch above "ไม่รวมในยอดรวม", with the line
  "รายจ่ายนับในรายงาน · ชำระบัตรด้วยการโอน". While it is on, "ไม่รวมในยอดรวม" is on and disabled,
  with the line "บัตรเครดิตไม่รวมในยอดรวมเสมอ".
- **Wallets tab**: rule 6 (mock-up frame 1).
- **Pay sheet**: rule 4 (frame 3); its title is "ชำระบัตร", the destination row isn't a picker.
- **Card in the Transactions tab**: rule 7 (frame 4).
- **Transfer sheet chip**: rule 5 (frame 6).

## Interactions

- **Transfer**: the pay sheet is the transfer sheet; transfer rules all hold.
- **Transactions / Reports**: "all wallets" (rule 2); `TransactionService.viewWalletIds`.
- **Recurring**: a rule on a card counts in "ทุกกระเป๋า"'s future rows like any counted wallet; a
  recurring transfer can pay a card (an amount fixed by the rule, not the amount owed).
- **Debt**: unchanged (an instalment plan bought on a card is a debt).
- **Export**: unchanged (`isCreditCard` isn't a column of the CSV).

## Open questions

Settled with the owner on 2026-11-15 (mock-up `credit-card.html`): **Q1** the "หลังหักหนี้บัตร"
line: yes. **Q2** entry points: all three (Wallets tab card section, the card's Transactions
banner, the transfer sheet chip). **Q3** old data: left as is.
