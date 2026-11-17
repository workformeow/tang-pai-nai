# Currency overview (#24)

> Status: **Built** (web only). Owner's choices on mock-up
> [`mockups/currency-overview.html`](mockups/currency-overview.html), round 1 (2026-11): way in
> **E1**, layout **P1**. It is option C of `mockups/report-currency.html`, left out of the
> Reports tab in #23 ([report.md](report.md) Q6).

## Purpose

A book with wallets in several currencies (a trip abroad, a foreign account) can see every
currency of one period on one screen: what came in, what went out, the net and the end
balance of each. The Reports tab shows one currency at a time; this page, **ภาพรวม** /
**Overview**, is the side-by-side view under it.

## Out of scope

- Adding currencies together or converting them (ROADMAP → Backlog "FX / multi-currency
  reports"). Each row stays in its own currency.
- A breakdown by category or a trend per currency: the Reports tab has them for the chosen
  currency.
- Opening Reports on a currency from a row (owner: the page is a report of its own; ‹ goes back).

## Data model

None. Every figure is an aggregate over the local database, read like the Reports tab's
(report.md → Volume). Nothing is stored and there is no API.

## Business rules

1. **The scope is every counted wallet of the book**, whatever the wallet switcher chose:
   the same wallets as the tabs' "ทุกกระเป๋า" (out-of-total wallets left out, credit cards
   kept, archived wallets included for their money). The page says so ("ทุกกระเป๋าในสมุดนี้").
2. **The period is the Reports tab's own** (unit, chosen period, custom range): changing it
   here changes it on the Reports tab and the other way round.
3. One row per currency **with money moving in the period** (the Reports tab's currency chips),
   in the book's wallet order (currency rule 6). A period with none shows the empty state.
4. Each row: flag + code; income and expense (signed, without the symbol); the net with the
   currency's symbol, `+` above zero; the number of open counted wallets in that currency
   (hidden at 0); the end balance (report.md rule 9). Each amount uses its currency's digits.
5. The figures are the Reports tab's for the same period with "ทุกกระเป๋า" (report.md rules 1,
   9, 11): `excludeFromReport` rows out of income and expense but in the balance, transfers and
   debts never income or expense.
6. **The way in shows only while the book's counted wallets hold more than one currency.**
7. A shared book in use doesn't show it, as with every report page (sharing.md: the Reports
   tab is own data only).

## Endpoints

None.

## Web screens

- **Way in (E1)**: a row **ภาพรวม** (coins icon, ›) at the top of the Reports tab's ⋮ menu,
  above "ดูตาม" (rule 6). Not on the Transactions tab's menu.
- **The page** `/reports/currencies` (`features/reports/pages/report-currencies-page`, a page in
  the Reports tab with ‹):
  - header: ‹, the title ภาพรวม, then at the top right **"ดูตาม"** as a pill with the current
    unit (`layout/report-unit-menu`, `@defer`red by `app-header`): เดือน / ไตรมาส / ปี /
    กำหนดเอง…, the Reports tab's units (rule 2); กำหนดเอง opens the range sheet on this page;
  - the period chips and the sideways swipe, as on the Reports tab;
  - a muted pill "ทุกกระเป๋าในสมุดนี้" (rule 1);
  - **P1**, one card listing the currencies (rule 3), one row each (rule 4): flag + code on the
    left, income · expense small in the money colours, the net large on the right; under it
    "n กระเป๋า" and "ยอดสุดท้าย …". Rows aren't buttons.

## Interactions

- Reads `ReportService` (`overview()`, `allWalletIds()`, `walletCounts()`, `manyCurrencies()`)
  next to the Reports tab's own signals; the period signals are shared.
- `formatMoney(…, signed)` (`@/shared/utils`) writes the signed net.

## Open questions

None.

**Decided while building** (owner, 2026-11-17): the name is **ภาพรวม** / **Overview**, not
"ภาพรวมทุกสกุล"; a currency with no money moving in the period has no row; "n กระเป๋า" counts
open wallets only.
