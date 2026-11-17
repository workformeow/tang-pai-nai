# Currency

> Status: the master table was built with offline sync 4a.2 (#5): code in
> `api/src/features/currency/`, the web app reads the pulled copy from its local database
> (`currencies` table). **#23 Currency picker: Spec** (owner, 2026-11, from the mock-ups
> `mockups/currency-picker.html` (the picker is layout **2B**) and `mockups/currency-picker-2.html`
> (the transaction sheet, the Wallets tab)).

## Purpose

A master list of currencies that wallets can use. Since #23 the user picks a wallet's currency
from a **curated set**: the currencies of the places Thai people travel to most, one per country
or area (Korea = South Korea's KRW only). More are added by a migration when needed.

## Out of scope

- **Exchange rates / conversion.** Each wallet keeps its own currency, and totals are grouped per
  currency (see ROADMAP backlog "FX").
- Every ISO 4217 currency, and a search in the picker.
- Per-user currency lists. The table is global, so every user sees the same active currencies.
- A book's main currency: a new wallet starts at THB (wallet rule 4), nothing is stored per book.
- A "by currency" card in Reports (every currency of the period on one card): its own PR after
  #23 (owner, 2026-11), see report.md.
- Quick amounts (transaction 8.2) for other currencies: THB wallets only for now.

## Data model

`src/core/database/schema/currency.ts`

- **currencies** — `code` (PK, ISO 4217, e.g. `THB`), `minorUnit` (digits after the decimal point,
  rule 2), `isActive` (default `false`), `sortOrder`, `createdAt`, `updatedAt`, `changeSeq`
  (offline-sync: master data is pulled like user data, but never pushed or deleted).

Names and symbols are **not stored**. The web app renders them with `Intl.DisplayNames` /
`Intl.NumberFormat` from `code`. The continent groups and flags are web-only data (rule 9).

Rows come from **migrations**, not the dev seeder, because production needs them too; each
changed row takes a new `changeSeq` and the migration raises `sync_state.last_seq`.
`0005_currency_seed` made THB (active) and 13 inactive ones. #23 adds a new migration (0005 is
never edited) that inserts the missing codes, activates all of the set, sets `sortOrder` in the
order below and sets `minorUnit` 0 for LAK and TWD (2 in 0005) **only if no wallet uses them**.

The set (#23), in `sortOrder` order; **bold** = `minorUnit` 0, the rest 2:

| Group (web)   | Codes                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| เอเชีย        | THB, **JPY**, **KRW**, CNY, HKD, MOP, **TWD**, SGD, MYR, **VND**, **LAK**, **KHR**, **IDR**, PHP, **MMK**, INR |
| ตะวันออกกลาง  | AED                                                                                                    |
| ยุโรป         | EUR, GBP, CHF, TRY                                                                                     |
| อเมริกา       | USD, CAD                                                                                               |
| โอเชียเนีย    | AUD, NZD                                                                                               |

New in #23: MOP, KHR, IDR, PHP, MMK, INR, AED, CHF, TRY, CAD, NZD.

## Business rules

1. `code` is 3 uppercase letters and never changes.
2. `minorUnit` is the number of digits **used in practice**, not always ISO's: IDR, LAK, KHR, MMK
   and TWD are 0 where ISO says 2. It never changes once any wallet uses the currency, because
   that would rescale every stored amount; so it is decided when the currency is added.
3. Only active currencies can be picked for a wallet (new, or changed while wallet rule 4
   allows). Deactivating a currency doesn't touch existing wallets. Every currency of the set is
   active; `isActive` stays for taking one out later.
4. A currency is never deleted; deactivate it instead.
5. `sortOrder` (ties broken by `code`) is the order inside the picker's groups and the fallback
   of rule 6.
6. **Lists per currency follow the book's wallet order** (owner, #23: the user orders wallets
   already): the Wallets tab's totals and the cards' owed totals, the Transactions tab's summary
   lines, Reports' summary cards and currency chips, an event's money. A currency sits where its
   first wallet sits in the book's order (archived wallets included); one with no wallet goes
   after, by rule 5.
7. **Amounts always use the currency's `minorUnit`** for display and input (`formatMoney`,
   `formatAmount`, the amount field, the keypad); never `Intl.NumberFormat`'s default digits for a
   currency (they differ, e.g. IDR). With `minorUnit` 0 the keypad's "." is off.
8. Where more than one currency is listed (the Wallets tab's totals), each line starts with the
   flag and the code: `narrowSymbol` gives "$" to USD, SGD, HKD, MOP, AUD, CAD, NZD and "¥" to both
   JPY and CNY.
9. **Groups and flags are hard-coded in the web app** (display only, owner 2026-11): code → group
   and code → flag (EUR = the EU flag, USD = the US flag, real flags for TWD and HKD too). A code
   the web doesn't map goes into an "อื่น ๆ" group with a plain badge. If an admin page ever
   comes, they move to columns of `currencies`.

## Endpoints

| Method | Path          | Auth   | What                        |
| ------ | ------------- | ------ | --------------------------- |
| GET    | `/currencies` | Bearer | Active currencies, in order |

Devices get **every** currency (inactive ones too, so an old wallet still formats) through
`/sync/pull` (offline-sync spec) and filter `isActive` themselves. No change in #23.

Activating or adding a currency is done by migration. There's no admin UI, because the app has
no admin role.

## Web screens

- **Wallet form** (wallet.md → Web screens): after the starting balance, a chip with the flag,
  the code and › while the currency may change (wallet rule 4), **shown even with one active
  currency**; once locked, the flag and the code as plain text with rule 4's line. The chip
  opens the **"สกุลเงิน" view** in the same sheet (depth 1, ‹ back).
- **"สกุลเงิน" view** (mock-up 2B, like `app-icon-field` with `groups`): a group "ใช้ในสมุดนี้"
  first (the currencies of the book's open wallets, rule 6's order; not shown while there are
  none), then the continents of rule 9. Each group is a 5-column grid of round flags with the
  code under each, the picked one ringed; a radio group whose labels are the full names
  (`Intl.DisplayNames`), no names on screen. Picking goes back to the form at once. No search.
- **Transaction sheet**: the wallet's flag and code beside the amount (not pickable: it is the
  wallet's); the quick-amount row only in a THB wallet; "." off with `minorUnit` 0 (rule 7).
- **Wallets tab**: rule 8 on the totals when there is more than one currency (one currency looks
  as before); the flag and code under the name of a wallet that isn't THB.
- **Flags**: SVGs from `flag-icons` (MIT, its `LICENSE` kept beside them), only the codes of the
  set, served as static files (round 1:1 for the picker, 4:3 elsewhere) and never put in a
  bundle, so the initial bundle doesn't grow. No emoji flags (Windows shows letters).

## Interactions

- Wallet stores `currencyCode` (FK) and uses `minorUnit` to validate amounts; its currency is
  fixed once it has transactions (wallet rule 4). Transactions, debts and debt entries use the
  wallet's currency.
- Transfers only between wallets of the same currency (transfer.md).
- Reports show one currency at a time (report.md rule 3, Q6); CSV export carries the code per row.
- Web formatting: `formatMoney(minor, code, minorUnit, locale)` (`@/shared/utils`, rule 7).
