# Tang Pai Nai — Roadmap

Single source of truth for **what is built, what is next, and which decisions are already locked**.
Read this first, before `AGENTS.md`, when picking up work or planning a feature.

> **For AI assistants:** this file tells you _what_ to build and _in what order_. _How_ to write code
> lives in each app's `AGENTS.md` (`api/AGENTS.md`, `web/AGENTS.md`). If this file disagrees with the code, the code wins — fix this file
> in the same change. Never re-open a decision listed under [Locked decisions](#locked-decisions)
> without the user asking; propose, don't assume.

---

## Product

**Tang Pai Nai (ตังค์ไปไหน, "where did the money go?")** is a personal income / expense tracker. Its
reference app is **Money Lover**, which the owner uses today; we keep what works there and drop the
rest. It's built for the owner and their family: anyone may sign up, and family members are brought
in by invitation to a shared wallet. No SEO, no monetisation. It feels like a native mobile app
(installable PWA with a bottom tab bar).

## Repo layout

One git repo, two independent apps side by side. There's no monorepo tool: each folder has its own
`package.json`, `node_modules` and lint config, and is deployed as its own Vercel project (Root
Directory = `api` / `web`).

| Path             | What                                   | Stack                                                       |
| ---------------- | -------------------------------------- | ----------------------------------------------------------- |
| `api/`           | REST API                               | Express 5 + TypeScript, Drizzle ORM, SQLite (Turso in prod) |
| `web/`           | Mobile-first PWA                       | Angular 22 (zoneless, signals), Tailwind v4, spartan/ui     |
| `docs/features/` | Feature specs, shared by both apps     | Markdown                                                    |
| `ROADMAP.md`     | This file                              |                                                             |
| `.github/`       | CI per app (path-filtered), automation | GitHub Actions                                              |

There's no shared code package. The API contract is the API's OpenAPI spec plus `docs/features/`,
and the web app mirrors the types it needs in `<feature>.type.ts`. Because both apps live in one
repo, one PR can change spec, API and web together.

---

## How we build a feature

**Vertical slices, one feature at a time.** Finish a feature end-to-end before starting the next.

**One feature (or one part of it, e.g. Auth 4.3) = one new Claude session = one branch = one PR.**
Start a fresh session for each instead of continuing an old one. The new session knows nothing of
earlier chats: it learns only from the repo (this file, the feature's spec, the `AGENTS.md` files
and `DESIGN.md`). So a session ends by writing down everything the next one needs (step 4), and a
decision agreed in chat but not in the repo is lost.

0. **Feature doc**. Write or refine `docs/features/<feature>.md` (template in that folder's
   `README.md`), agree on it, and commit it on its own (`docs(<feature>): ...`). It is the shared spec
   for API and web.
1. **API**. Drizzle schema + migration + seed, then the feature (entity → repository port → service →
   Drizzle adapter → schema/controller/routes), following `AGENTS.md` §6 and §8.
2. **Web**. Screens under `src/app/features/<feature>/`, following the web repo's `AGENTS.md`.
3. **Tests**. Once the feature works end to end (manual checks: `curl` for the API, Playwright for
   the web) and the owner confirms the behavior, write the tests for both apps as the last commits
   of the PR (see `api/AGENTS.md` §1 Testing). Not earlier: tests against code that is still
   changing just get rewritten.
4. **Update this file** (the hand-off to the next session). Move the feature to ✅ and note any new
   decision, deferred item or known issue, including tests left pending for a feature that is
   still experimental. Rules that apply beyond the feature go where they belong (`AGENTS.md`,
   `DESIGN.md`), not only in the PR or the chat.

Small, separate commits per step. Each PR gets a Vercel preview URL, so check it on a phone before
merging.

---

## Status

| #   | Feature / phase                | API | Web | Notes                                                                                                                                                                                                                                                   |
| --- | ------------------------------ | --- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Starter repos                  | ✅  | ✅  | API from `node-express-ts-starter`; Angular 22 + Tailwind + shared lint                                                                                                                                                                                 |
| 1   | Local dev workflow             | ✅  | ✅  | run both apps in the sandbox, `/api` dev proxy, notifier (email/SMS providers), no API keys                                                                                                                                                             |
| 2   | Database foundation            | ✅  | —   | Drizzle + `@libsql/client`; local file DB, Turso in prod; migrations, seed                                                                                                                                                                              |
| 3   | App shell                      | —   | ✅  | PWA (offline app shell), bottom tab bar, dark mode, empty tab pages. See below                                                                                                                                                                          |
| 4   | Auth                           | ✅  | ✅  | email code + link, password, Google, Security page, phone OTP. [spec](docs/features/auth.md)                                                                                                                                                            |
| 4a  | Offline sync foundation        | ✅  | ✅  | 4a.1 encrypted local DB + PIN lock; 4a.2 outbox, `/sync/push` + `/pull`, sync pill. [spec](docs/features/offline-sync.md)                                                                                                                               |
| 5   | Currency                       | ✅  | ✅  | master table, THB default; built with 4a.2, pulled to the device. [spec](docs/features/currency.md)                                                                                                                                                     |
| 6   | Book + Wallet               | ✅  | ✅  | 6.1 books; 6.2 wallets (`wallet_members`, `tpn` icons, near-full sheets, `sync_probes` gone). [book](docs/features/book.md) · [wallet](docs/features/wallet.md)                                                                                |
| 7   | Category                       | ✅  | ✅  | 7.1 categories, default set, Account › หมวดหมู่; 7.2 hide per wallet (both forms); 7.3 merge. [spec](docs/features/category.md)                                                                                                                         |
| 8   | Transaction                    | ✅  | ✅  | 8.1 table, form + keypad, Money Lover tab, real balances; 8.2 quick amounts, toasts on top. [spec](docs/features/transaction.md)                                                                                                                        |
| 9   | Transfer                       | ✅  | ✅  | two linked rows of one `transfers` row, outside income / expense; ⋮ menu, Wallets tab button. [spec](docs/features/transfer.md)                                                                                                                         |
| 10  | Reports                        | —   | ✅  | on the device: H1 summary with balances, trend, by category with drill-down pages; Transactions header shared. [spec](docs/features/report.md)                                                                                                          |
| 11  | Budget                         | ⏸   | ⏸   | moved to the backlog after #10 (owner: not used in Money Lover; reports cover it); see Backlog                                                                                                                                                          |
| 12  | Recurring transactions         | ✅  | ✅  | rules recorded on the device when due (or asked first), deterministic ids, "อนาคต" shows what comes. [spec](docs/features/recurring.md)                                                                                                                 |
| 13  | Debt / loan                    | ✅  | ✅  | borrowed / lent, entries outside income / expense, counted once per debt, instalments as rules, "หนี้สิน" card. [spec](docs/features/debt.md)                                                                                                           |
| 14  | Event / trip                   | ✅  | ✅  | events per book, one per transaction, totals computed, default by date, close / reopen; under `/transactions/events`. [spec](docs/features/event.md)                                                                                                 |
| 15  | CSV export + move transactions | —   | ✅  | owner cut search and filters; Account › ส่งออก CSV, "ย้ายรายการ" in the category sheet, no API change. [spec](docs/features/export.md)                                                                                                                  |
| 16  | Family sharing                 | ✅  | ✅  | 16.1 invites per person, Account › แชร์กระเป๋า; 16.2 shared books in the switcher, online only, editors write. [spec](docs/features/sharing.md)                                                                                                      |
| 16R | Shared components              | —   | ✅  | `date-row` (4 sheets) and `wallet-pick` (3 sheets) moved to `shared/components`; same look, same initial bundle                                                                                                                                         |
| 17  | Deploy (Vercel)                | ✅  | ✅  | **staging only** (`develop`), the app's show-and-test copy; production waits until the family uses it for real (owner, 2026-11). [steps](docs/deploy.md)                                                                                                |
| 18  | Credit card                    | ✅  | ✅  | `wallets.isCreditCard`: out of the total, counted in "ทุกกระเป๋า"; paid by one transfer (pay sheet, Wallets tab card section). [spec](docs/features/credit-card.md)                                                                                     |
| 19  | Loading                        | —   | ✅  | splash in `index.html` until the first page, a creeping bar for slow page changes, a new device waits for its whole first pull. [spec](docs/features/loading.md)                                                                                        |
| 20  | Live sync                      | ✅  | ✅  | a poke `{ seq, deviceId }` after a push that applied something; `user:` → a sync round, `book:` → a shared read; `local` SSE in dev, Ably on Vercel (staging on, 2026-11). [spec](docs/features/live-sync.md)                                         |
| 21  | Shared activity                | —   | ✅  | who added, edited or deleted which transaction in a shared book (latest action per row, 90 days), under ⋮ after รายการซ้ำ; names on rows when not you; stays 90 days after sharing ends. Web only. [spec](docs/features/shared-activity.md)                                                            |
| 22  | Privacy & account deletion     | ✅  | ✅  | a privacy notice open without sign-in (`/auth/privacy`, Account › เกี่ยวกับแอป), "test version" from `TEST_VERSION`, "signing in accepts the notice"; delete the account at once (recent auth + typed email + button). [spec](docs/features/privacy.md) |
| 23  | Currency picker                | ✅  | ✅  | 25 travel currencies, all active (migration 0022; LAK / TWD to 0 digits); a flag grid per continent in the wallet sheet (2B); per-currency lists in wallet order; THB-only quick amounts; Reports one currency at a time with the tiles as the switch (B). [spec](docs/features/currency.md) |
| 24  | Currency overview              | —   | ✅  | ภาพรวม: every currency of the Reports period side by side over every counted wallet (P1 rows: income · expense, net, wallets, end balance), from the Reports ⋮ (E1) with more than one currency; the Reports period, "ดูตาม" top right. Web only. [spec](docs/features/currency-overview.md) |
| 25  | Demo                           | ✅  | ✅  | ทดลองใช้ Demo for job applications: a card under the sign-in forms → `/auth/demo` (intro, Turnstile, one button) → a demo user of its own with ~3 months of seeded data (migration 0023), pulled behind a checklist loader, straight to Transactions; no sharing; password / Google / phone / invites / delete shown disabled (`403 DEMO_NOT_ALLOWED`); 2,000 rows at most; จบ Demo deletes at once, the cron after 24 h; `DEMO_ENABLED` on staging and production. [spec](docs/features/demo.md) |
| WR  | Web clean-code refactor        | —   | ✅  | one file per template / style / spec; `layout/` (shell) vs `sheets/` (app-wide sheets), lint-enforced; large sheets and pages split by readability, one shared amount keypad, `ActivityService`; e.g. lines on pure functions. No behaviour change but two fixes (below) |

✅ done · 🚧 in progress · ⬜ not started · ⏸ deferred to the backlog · — not applicable

Order of work from here (owner, 2026-11): **#22 (done) → #20 (done) → #21 (done) → #23 (done) → #24 (done) → #25 (done)**; then Playwright end-to-end tests (Backlog) once the wanted features are done. The number is a feature's id, not
its place in the queue, so numbers are never reused or shuffled. Each row gets its `docs/features/<feature>.md` before work starts. Rows 0–8 (with 4a) are the MVP.
After #8 the app can replace Money Lover for daily use. Until #17, everything runs **locally only** (see locked
decision "Local-first").

---

## Done: More icons and colour shades (2026-11)

Web only, no API change (the server checks only the shapes of `icon` and `color`). Owner: tell
family members, pets and similar wallets apart (two cards at one bank, Grab and LINE MAN), and
health needs a haircut. Mock-ups: [category-icons.html](docs/features/mockups/category-icons.html)
(icons kept as drawn) and [category-colors.html](docs/features/mockups/category-colors.html)
(option A of A–C).

- **Icons**: 82 more (66 lucide, 16 `tpn`: seven faces, barber's pole, tooth, lipstick, spa
  lotus, delivery scooter, toll gate, gas cylinder, sneaker, grill pan). `CATEGORY_ICON_GROUPS`
  gains คน, สัตว์เลี้ยง and สุขภาพและความงาม (first), and บันเทิงและสุขภาพ became
  บันเทิงและงานอดิเรก (`funHobby`); each icon sits in one group. The scooter is in the wallets'
  digital group too. Paying for a brother who pays back at month end stays two plain categories
  (expense + income with his face), not a debt.
- **Colours** (option A): the 10 `USER_COLORS` stay the swatches; under the chosen one a strip
  of its 4 shades (`COLOR_SHADES`, `colorTone`), 40 colours in all, every one white-glyph safe.
  `USER_COLORS` is unchanged, so stored colours and the activity avatars keep theirs. Used by
  every colour picker (book, wallet, category, event). Options B (10 + "more", all 40 at once)
  and C (20 fixed) were dropped: too many at once, or too few greens.
- **Tests**: `COLOR_SHADES` / `colorTone`, the category catalogue (known, once each, labelled),
  `color-field.spec.ts` (tone, shades, picking, a colour outside the palette).
- Not done: the default category set is unchanged (no ตัดผม child under สุขภาพ); a user adds
  it.
- **Bundle budget** (owner, 2026-11): the initial bundle went 783.8 → 819.9 kB (192.6 → 198.8
  kB gzip), because `app-icon-badge` registers every user icon and the shell draws badges (book
  switcher), so the whole catalogue is in the initial bundle. The warning budget goes 800 →
  **850 kB**; loading the catalogue lazily is left for later.

---

## Done: Cash vs credit card on the Transactions tab (2026-11)

Web only, no API change (`isCreditCard` came with #18). Owner: in the family's spreadsheet it
was hard to tell what was paid by card; mock-ups A–C, A1–A3, S1–S2 and K1–K3 were tried, A2 and
K1b kept.

- **Rows** (A2): on "ทุกกระเป๋า" a row in a credit card carries a small chip in the card's colour
  with a card glyph before its amount (`RowWallet.isCreditCard`, `EntryRow.card`); the row keeps
  its height. Upcoming rows don't (yet).
- **Summary card** (K1b): รายรับ | รายจ่าย, then เงินสด / โอน and บัตรเครดิต (small, muted,
  aligned) | สุทธิ; only on "ทุกกระเป๋า" while both kinds were spent
  (`MoneySummary.cardExpense` from the same aggregate, `MoneySplit`). An 8px bar was tried first
  and dropped: it outshone the list.
- **Currency chips**: with more than one currency, ทั้งหมด + flag and code over the summary
  (like Reports); one currency's card, the first to start with, or `app-money-summary-table`
  for ทั้งหมด. They choose the summary only.
- **Tests**: `summary()`'s `cardExpense`, the card's split and the table
  (`money-summary.spec.ts`), the page's card marks, split and chips.

---

## Done: Note in two taps (2026-11)

Web only, no API change. Owner: adding a note took four taps (the row, the box, the keyboard's
OK, ‹); now the row opens it with the keyboard up and the keyboard's done goes back.

- **Note view** (transaction, transfer, debt and repayment sheets): `app-textarea-field` takes
  `autofocus` and `doneOnEnter` (the return key reads "done"; Enter or leaving the text emits
  `done`; Shift + Enter and a composing Enter type; leaving while the app is in the background
  doesn't count). The row's `openNote()` renders the view inside the tap (`ApplicationRef.tick()`),
  so the focus lands there and iOS Safari brings the keyboard up (a hidden proxy input was tried
  first and didn't). The view shows in place (`appSlideStill` on `appSlide`): a sliding field
  flickered on iOS, its caret drawn where the field ends up.
- **Checked** on an iPhone (owner) and in a desktop browser. **Tests**: `textarea-field.spec.ts`,
  the slide's still case, the transaction sheet's focus-in-the-tap and done; web 843 → 850.

---

## Done: Web clean-code refactor (WR, 2026-11)

Built 2026-11-17 / 18 on `refactor/web-cleancode`, one commit per step, each checked in the app
(Playwright on the Demo account, 375×812). The owner's rules it wrote down are in web/AGENTS.md
§2 (folders) and §3 (Component files, Readability first, the e.g. rule).

- **Files**: every component is `.ts` + `.html` (+ `.css` only when Tailwind can't say it) +
  `.spec.ts`; 110 inline templates moved out by an AST script; lint
  `component-max-inline-declarations` at 0 (spec hosts exempt).
- **Folders** (owner): `layout/` holds the shell only (header, tab bar, banners, first-run
  steps); the 8 app-wide sheets and their parts moved to a new `sheets/` (one folder each);
  `repeat-row` to `shared/components`. Lint `local/component-folder` and the layer direction
  `layout → sheets → core → shared`, `features → core → shared`. A generic SheetService was
  weighed and left out on purpose (AGENTS §2 "How a sheet opens").
- **Readability first** (owner): line counts only prompt a look. Split where a part reads on its
  own: `transaction-category-pick`, `event-pick`, `category-merge` (sheets);
  `entry-row`, `upcoming-row` and `day-groups.ts` (Transactions tab); plain logic beside its
  screen (`transaction-values`, `transfer-values`, `debt-plan`, `device-label`'s rows).
  Left whole where splitting would pass state back and forth (the security page, the wallets
  page, the form views): members ordered by section instead.
- **Shared code**: `AmountKeypad` + `amountValidator` (`shared/components/form`) replace four
  copies of the keypad (transaction, transfer, debt, debt entry); `describeRepeatHint`
  (`core/recurring`); `amountText` (`shared/utils`).
- **Services**: `ActivityService` split out of `TransactionService` (scope, list, people,
  shares); `transaction-rows.ts` and `orphan-sweep.ts` beside it; the category merge plan
  joins `category-merge.ts`; recurring, debt and offline services got section comments only
  (the offline one checked line by line: no code line changed).
- **Fixed on the way** (owner): a sheet's title and rows changed while it animated closed
  (`keepWhileClosing`, every service-bound sheet); the keypad's unused `+ − × ÷` engine and
  "= result" preview removed (`parseMajor` reads the amount; initial −1.27 kB).
- **e.g. lines** (owner): ~60 pure functions show real calls and results in their doc, worked
  out by running them; `doc-examples` specs check the same values.
- **Checked**: every step's checklist in the app (sheets, keypad, merge, archive / undo, order
  mode, PIN lock, one tab at a time, debts, closing a debt, transactions paging); web tests
  815 → 843; initial total 784.18 → 783.29 kB.

---

## Done: Demo (#25)

Built and tested 2026-11-17 on `feat/demo`. [spec](docs/features/demo.md). Migration
`0023_demo_users` (`users.is_demo`); `DEMO_ENABLED` must be set to `true` on staging and
production (Vercel env) for the button to show.

- **Decided at the start** (owner, Q1): the seed's rows, reviewed as a table before any code
  (demo.md → The seed): an office worker in Bangkok on ฿35,000, five wallets (the yen bought
  with an exchange pair kept out of the reports), rent and a streaming subscription as rules,
  a loan to "เพื่อนร่วมงาน" (no nickname), a closed Japan trip.
- **Decided while building** (owner): no note where the category already says it; the bank
  starts at ฿80,000 (it went below 0 for some start days); ลองใหม่ on a failed first pull pulls
  again instead of making a second demo; `DELETE /auth/demo` from a real account is
  `403 NOT_DEMO`; sharing refuses only invite / resend / accept (the app reads "shared with
  me" at start); the profile card says "บัญชีทดลอง ไม่มีอีเมล" instead of the placeholder
  address; the sign-in entry is a divider ("อยากลองก่อน?") and a card, not a button that looks
  like the form's; the banner sits under the header; the privacy notice gains a line.
- **Also in this branch** (owner, 2026-11-17): the default categories split food into
  **อาหารประจำวัน** and **เครื่องดื่ม** (a pricier meal stays on the parent) and add **รถไฟฟ้า**
  under การเดินทาง (category rule 8; 28 categories, books made before keep theirs); a
  top-level category's report page names it under its icon, like a sub-category's path.
- **API**: `auth.demo-seed.ts` (the template, pure; the default set copied from the web's),
  `authService.startDemo` / `endDemo` / `isDemo`, `authRepo.seedDemo` (one block of
  `changeSeq`s, parents first) and `deleteExpiredDemos` (in `cleanup`), `refuseDemo`
  (`core/middleware`, used by auth and sharing), `demoRowCount` (`core/database`) for the
  sync cap (`DEMO_LIMIT`), no mail to a demo's address.
- **Web**: `/auth/demo` (`DemoPage`), the sign-in card and expired line, `layout/demo-loader`
  and `layout/demo-banner` in the shell, `AuthService.startDemo` / `endDemo` /
  `takeDemoExpired` (`tpn-demo` in localStorage makes a refused refresh of a demo wipe like a
  revoked one), the Account and Security rows turned off, `notInDemo` on their routes.
- **Checked** with Playwright at 375×812 in Thai and English, light and dark: start → checklist
  → Transactions (due card, ฿ and ¥ totals) → Account → จบ Demo; a deleted demo wipes the
  device on the next open. A demo starts in about 0.2 s and pulls ~420 rows in one page.
- **Tests**: API 755 (seed builder over a year of start days, service, HTTP, SQLite seed and
  cascade, `refuseDemo`, the sync cap, sharing refusals); web 815 (demo page, sign-in card,
  checklist, banner, Account, Security, `AuthService`).

---

## Done: Currency overview (#24)

Built and tested 2026-11-17 on `feat/currency-overview`. [spec](docs/features/currency-overview.md).
Web only, no migration.

- **Decided at the start** (owner, mock-up `currency-overview.html`): way in **E1** (a row in
  the Reports ⋮, only with more than one currency; not a link on the page), layout **P1** (one
  compact row per currency); every counted wallet whatever the switcher chose; the Reports
  tab's own period, changeable from the top right; rows don't open Reports (‹ is the way
  back); a shared book is kept out like every report page; a spec file of its own.
- **Decided while building**: the name is **ภาพรวม** / **Overview** (owner, after seeing
  "ภาพรวมทุกสกุล"); only currencies with money moving in the period get a row; "n กระเป๋า"
  counts open wallets.
- **Web**: `ReportService.allWalletIds` / `overview` / `walletCounts` / `manyCurrencies`,
  `features/reports/pages/report-currencies-page`, `layout/report-unit-menu` (in
  `app-header`, `@defer`red), the ⋮ row in `transactions-header`, `formatMoney`'s `signed`.
- **Tests**: the page, the unit menu, the ⋮ row, `isReportCurrencies`, the service's
  overview signals, signed `formatMoney`.

---

## Done: Currency picker (#23)

Built and tested 2026-11-17 on `feat/currency-picker`. [spec](docs/features/currency.md).
**Before staging runs the new web: `npm run db:migrate:staging`** (migration 0022).

- **Decided at the start** (owner, three mock-ups: `currency-picker.html`,
  `currency-picker-2.html`, `report-currency.html`): a curated set of 25 travel currencies,
  one per country (MOP and TRY added in round 2), all active, `isActive` kept for later; the
  digits used in practice (JPY KRW VND LAK KHR IDR MMK TWD = 0); continents and flags
  hard-coded in the web (an admin page, if ever, moves them to columns); the picker is **2B**
  (round flags + code, 5 columns, names only for screen readers, "ใช้ในสมุดนี้" first, no
  search); no main currency per book (new wallets start at THB); flag + code wherever several
  currencies are listed; quick amounts for THB only; real flags for TWD and HKD.
- **Decided while building**: lists per currency follow the **book's wallet order** (owner:
  the user orders wallets already; currency rule 6); the chip shows even with one active
  currency; flags are static SVGs in `web/public/flags/` (prefetched by the service worker, no
  bundle cost: initial 776.3 kB); the "." key is off and quick amounts hidden in all four
  keypad sheets. **Reports** (owner, after seeing two identical summary cards): **B**, the
  currency chips on top, one summary card naming its currency, its income / expense tiles
  replacing the breakdown's tabs; the category page names its currency too. **C** (every
  currency side by side) is a page of its own later (Backlog).
- **API**: migration `0022_currency_picker` (inserts 11, activates all, sets `sortOrder`,
  LAK / TWD to 0 only while no wallet uses them, a `changeSeq` per changed row). No code
  change. **Web**: `shared/components/currency-flag` (`app-currency-flag`, `CURRENCY_GROUPS`,
  `CURRENCY_FLAGS`), `sheets/currency-pick`, the wallet sheet's chip and `currency` view,
  `WalletService.currencyOrder` / `compareCurrency` / `bookCurrencies`,
  `QuickAmountsService.forCurrency`, the keypad's `minorUnit`, the amount field's flag, the
  Wallets tab's lines, the Reports summary card's tiles.
- **Verified**: Playwright on 375×812, Thai (new wallet THB → picker → JPY → no decimals; three
  wallets in three currencies on the Wallets tab; the JPY transaction sheet without quick
  amounts and with "." off); the owner confirmed the behaviour (Reports B included).
- **Tests**: API `currency.repository.drizzle.test.ts` (the set, order, digits, the LAK guard,
  `changeSeq`s); the "active currency" tests switch one off; the sync counter starts at 38.
  Web: the wallet sheet's picker, `compareCurrency` / `currencyOrder`, `forCurrency`, the
  keypad, `app-currency-flag`, the Wallets tab's lines, the Reports tiles and chips, the
  category page's currency. API 62 files (in Docker, Linux), web 778 tests.
- **Known**: on Windows the API's DB tests still fail at teardown (`EPERM`); run them in a
  Linux container (`docker run … node:26.13.1-bookworm-slim`, `npm ci` on a copy) or let CI
  run them. The four sheets' quick amounts / "." wiring has no sheet-level test (the service
  and the keypad have).

---

## Done: Deploy (#17), staging only

**Owner, 2026-11: staging only for now.** This is a personal project shown to friends; production
(`main`, its own Turso database and secrets) goes up only once the family uses the app for real
(Backlog → "Production deploy"). The steps below stay valid for that day.

**Code: done in the #17 PR.** What's left is the owner's setup in each dashboard, step by step in
[docs/deploy.md](docs/deploy.md): GitHub settings, Turso (staging + prod), Resend, Cloudflare
Turnstile, the two Vercel projects and their environment variables, then the first check on
staging.

Decisions (owner, #17):

- **Bot check: Cloudflare Turnstile** (owner, 2026-11, [auth.md](docs/features/auth.md) rule 32) on the three sign-in calls that send mail / SMS or check a password, so a bot can't spend
  the daily mail cap for the whole family. Invisible unless Cloudflare asks for a click; off
  without `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`, fails open when Cloudflare is down (the
  DB limits stay). Not on verify, Google, or anything behind a session. The domain's DNS stays
  "DNS only" (no Cloudflare proxy or Bot Fight Mode in front of Vercel). Tests: API (verifier,
  `checkHuman`, the gate on the three routes) and web (`BotCheck`, the forms sending the token)
  are still to write once the owner confirms the behaviour.

- **Staging = the `develop` branch** (Vercel _Preview_ scoped to `develop`), production = `main`;
  each with its own Turso database and secrets. Migrations run by hand from the owner's PC
  (`npm run db:migrate:staging` for staging, `npm run db:migrate` with production's URL), never
  by a deploy.
- Mail: Resend through the existing SMTP adapter (env only). SMS stays `disabled` (phone sign-in
  hidden) and Google stays off until the owner sets them up. Account's Security row says only
  "รหัสผ่าน, PIN และอุปกรณ์" (`account.securityHint`, owner 2026-11): add phone / Google back to
  it when they are turned on.
- `/api` on the web goes through **Vercel Routing Middleware** (`web/middleware.js`, `API_ORIGIN`
  per environment) instead of a fixed rewrite in `vercel.json`, so staging and production each
  reach their own API (locked decision "Same origin via rewrite" still holds).
- Cleanups: `GET /auth/cleanup` and `GET /sync/cleanup` behind `CRON_SECRET`, two daily Vercel
  Cron jobs (production only; on staging by hand).
- **Local check before a deploy: Docker** (owner, 2026-11). A root `docker-compose.yml` builds
  both apps as they ship (`api/Dockerfile`, `web/Dockerfile` with nginx standing in for
  `middleware.js`) and runs them with one command, no npm: book `dev` (`.env.dev`, mail in the
  log, `:8080`) and `staging` (`.env.staging`: staging's real Turso, Resend and Turnstile, the
  same file imported into Vercel Preview, `:8081`; owner 2026-11). `dev` has its own SQLite
  volume of test users only. Migrations run at container start (on `staging`: the staging
  database). Production's keys live only in Vercel. Still no root `package.json` ("One repo, two
  folders" holds). Commands: README → Run in Docker. Environments: [docs/env.md](docs/env.md).

Known: a pull request's own preview URL can't keep a session (the API accepts the refresh cookie
only from `WEB_ORIGIN`): test sign-in on the `develop` URL. `TRUST_PROXY_HOPS` is checked on the
first staging deploy (docs/deploy.md step 7).

---

## Done: Credit card (#18)

Built and tested 2026-11-15, merged into `develop` the same day. Before staging runs the new
web: `npm run db:migrate:staging` (migration 0020).

- **Decided at the start** (owner, mock-up `docs/features/mockups/credit-card.html`;
  credit-card.md → Open questions): a card stays a **wallet** with one flag, `isCreditCard`
  (no wallet type); it is always out of the total but counts in "ทุกกระเป๋า", so a purchase is
  an expense in its real category on the day it was made, and the bill is paid with **one
  transfer** (no "ชำระบัตร" category, no income on the card). Q1 the "หลังหักหนี้บัตร" line
  under ยอดรวม: yes. Q2 three ways in: the Wallets tab's card section (ชำระ), the card's
  Transactions banner (ชำระบัตร), the transfer sheet's "ใช้ยอดค้าง" chip. Q3 old rows: left as
  they are. Statement cycles / due dates: phase 2 (out of scope).
- **Decided while building**: a report's start / end balances include the cards (money − card
  debt), so end − start = net + transfers still holds; the pay sheet is the transfer sheet in a
  `pay` mode (to fixed, the amount owed filled in, no ⇅, no repeat, no save-and-add) and
  remembers the source per card (`tpn-book:tx:transfer:pay:<cardId>`); a member of a shared
  wallet always gets `isCreditCard: false`.
- **API**: migration `0020_wallets_credit_card`; `wallet.schema.ts` refuses a card counted in the
  total (`VALIDATION`, credit-card rule 1); a push without the field means `false`; OpenAPI
  `SyncWalletRow.isCreditCard`. **Web**: schema step 15; `WalletService.cards()` / `owed()` /
  `owedTotals()`; `TransactionService.viewWalletIds` adds cards; `TransferService.pay()` /
  `payFromId()`; the wallet sheet's switch (locks "ไม่รวมในยอดรวม"), the Wallets tab's card
  section, the Transactions tab's ค้างจ่าย header and banner, the transfer sheet's `pay` mode
  and chip.
- **Verified**: API typecheck + lint, the wallet schema / repository tests; web `npm run fix`,
  typecheck, `npm test` (692), `npm run build` (initial 758.3 kB); Playwright on 375×812, Thai,
  light and dark: card switch → Wallets tab (card section, ชำระ, หลังหักหนี้บัตร) → card
  expenses in "ทุกกระเป๋า" → card view banner → pay sheet (debit, 8,400 filled in) → total down,
  card 0, both transfer sides in view → chip "ใช้ยอดค้าง" → Reports by real category.
- **Tests** (after the owner confirmed): API the wallet schema (a card counted in the total is
  refused) and repository; web `WalletService.cards` / `owed` / `owedTotals` and the forced
  exclusion on save, `viewWalletIds` with a card, `TransferService.payFromId` / `pay`, the
  transfer sheet's `pay` mode and chip, the wallet sheet's lock, the Wallets tab's card section,
  the Transactions tab's ค้างจ่าย header and banner. Web `npm test` 704.
- **Known**: on Windows the API's DB tests fail at teardown (`EPERM` removing the temp folder) and
  Vitest needs `--pool=vmThreads` with Node 26.13.0 (the repo pins 26.13.1); CI on Linux is
  unaffected. Not covered by a test yet: a shared wallet's member rows carry `isCreditCard: false`
  (`sharing.service.ts`).

---

## Done: Loading (#19)

Branch `feat/web-loading`, built and tested 2026-11-15. Web only, no API change.
[spec](docs/features/loading.md), mock-up `docs/features/mockups/loading.html`.

- **Why** (owner): opening the app showed a blank screen until the JavaScript, `/auth/refresh` (slow
  when the server starts cold) and the local database were all done, so it looked frozen.
- **Decided** (owner, from the mock-up): a splash in `index.html` (icon + name at once; after 1 s
  a bar and what it waits for; after 10 s "การเชื่อมต่อใช้เวลานานกว่าปกติ" + ลองใหม่); one loader
  for a new device's first pull, which now waits for the **whole** first round (rows so far
  shown) so the first numbers don't move; no bar for background sync (the header's icon is
  enough); a creeping bar for slow page changes (over 300 ms, holds under 90 %, then fills).
  **No preloading** of the lazy pages: the service worker already caches every chunk once
  installed, so only a device's first session is slow; measure on staging before adding it.
- **Web**: the splash markup, CSS and timers in `index.html`; `BootSplash` (`core/boot`):
  `AuthService.restore()` sets `auth`, `shellGuard` `data`, `App` removes it after the first
  navigation; `NavProgress` (`layout/nav-progress`, `transform` only);
  `BookService.firstPull` + `SyncService.pulledRows` for the shell's `loading` gate.
- **Verified**: web `npm run fix`, typecheck, `npm test` (713), `npm run build` (initial
  762.3 kB, +3.9 kB); Playwright on `ng serve`: a slowed `/auth/refresh` (splash steps, the 10 s
  line, gone at once after), a slowed lazy chunk (bar 20 % → 86 %, then 100 % and gone; a fast
  page change shows nothing), a wiped local database with a slowed second pull page ("ได้รับแล้ว
  48 รายการ", then the whole data).
- **Tests**: `NavProgress` (fake timers), `BootSplash`, `AuthService.restore` step,
  `BookService.firstPull`, `SyncService.pulledRows`.
- **Known**: over the dev tunnel a cached old `main.js` with the new `index.html` leaves the
  splash up (the old script never removes it); Ctrl+F5 fixes it. Production can't mix them
  (hashed file names, `index.html` not cached, the service worker serves one version).

---

## Done: Live sync (#20)

API + web. [spec](docs/features/live-sync.md). Another open device of the same user, or a
member viewing a shared book, sees a change within about a second instead of the next timed
round (5 min own, 1 min shared). Decisions at the start: timed rounds unchanged, the sync sheet
line shown, nothing in the background (spec → Decisions).

- **API**: `core/live` (port `LiveProvider`: `disabled` / `local` / `ably` by `LIVE_PROVIDER`,
  like the notifier; `livePublisher` sends each poke within 1 s and only logs a warning).
  `SyncService.push` collects the rows it newly applied and, after their transactions, awaits
  one poke per channel: `user:<owner>` and `book:<id>` for a shared wallet (old and new
  wallet on a move). `features/live`: `POST /live/token` (Ably token request, subscribe only,
  1 h, the channels of rule 3 from `core/database/live-access`), `GET /live/events` (`local`
  SSE, rule 3 per poke, ends after 10 min). `ABLY_API_KEY` is required with `ably`;
  `setup-env` writes `LIVE_PROVIDER=local` into `.env.dev`, `disabled` elsewhere. No migration.
- **Web**: `core/live` `LiveService` owns the connection (signed in, online, foreground, someone
  listening); `SyncService` listens on `user:` while the local DB is open, `SharingService` on
  `book:<id>` while that shared book is in use (a poke during a read reads once more).
  Own and old pokes are ignored, a 300 ms burst runs one round, failures are quiet. The `local`
  stream is `fetch` with the bearer (and `ngsw-bypass`); Ably's SDK is a dynamic `import()`
  (211 kB lazy chunk), the initial bundle 763 → 768 kB. Sync
  sheet: "อัปเดตทันที: เชื่อมต่อแล้ว / ไม่ได้เชื่อมต่อ", hidden with `disabled`.
- Tests: API 686, web 734. Checked with `local` in Chromium: a push from another device id
  showed on the open app in about 0.8 s; the sheet line; a wrong Ably key leaves the push
  `applied` with a warning in the log.
- **Ably SDK split** (after Ably error 40168 on an account billed by MAU): the old `ably` 2.30
  package is refused there. The API now uses `@ably/pubsub-server` (a server: API key, not
  counted as MAU) and the web `@ably/pubsub-device` (a device, ESM, so no
  `allowedCommonJsDependencies`; lazy chunk 180 kB). The token request carries `clientId` =
  user id, which a device connection on a MAU account must have. Tests: API 687, web 734. Not
  yet checked against a real Ably app.
- **Faster sync** (after live sync worked on staging): a local write now starts its round after
  0.5 s instead of 2 s (offline-sync rule 11; one action's writes still go in one push), so
  another device sees it about 1.5 s sooner. "sync ตอนนี้" closes the sync sheet when the round
  leaves nothing to look at, with no toast. Tests: web 739.
- **Ably on staging** (owner, 2026-11): the staging Ably app (free plan) is set up, with
  `LIVE_PROVIDER=ably` and `ABLY_API_KEY` on the API's Vercel Preview and in `api/.env.staging`
  ([deploy.md](docs/deploy.md) step 3c), so staging runs with live sync on. Checked by the owner
  with step 7.5 on two devices: a change on one shows on the other as expected.

---

## Done: Privacy notice and account deletion (#22)

API + web. [spec](docs/features/privacy.md). Owner: friends are about to try staging, so they
must be able to read what is kept and delete their account themselves (PDPA minimum).

- **API** (`features/auth`): `DELETE /auth/account { email, currentPassword?, lang }` checks the
  typed email first (`422 ACCOUNT_EMAIL_MISMATCH`), then recent auth (`403 REAUTH_REQUIRED`),
  then deletes the user in one transaction: every table cascades from `users`, plus sign-in
  codes and invites **addressed to** the email (they hold it without a user id). A mail says so
  afterwards; a failed send undoes nothing. `GET /auth/account/deletion` = how many people the
  user's live wallets reach. `TEST_VERSION` (setup-env writes `true` for dev and staging) is
  `testVersion` in `GET /auth/providers`. The credential mails and this one share one sender.
- **Web**: `/auth/privacy` (before sign-in) and `/account/privacy` (Account › เกี่ยวกับแอป) show
  `PrivacyPage`; the sign-in page has the test-version line, "รายละเอียดการเก็บและใช้ข้อมูล:
  ประกาศความเป็นส่วนตัว" and, after a deletion, "ลบบัญชีแล้ว". Security › บัญชีผู้ใช้ › ลบบัญชี
  (`/account/delete`, ‹ to Security): what goes (people shared with, unsynced changes), a link
  to CSV export, the confirm step (`ReauthFlow`), the typed email (button off until it matches),
  then `OfflineService.wipe()` and sign-in.
- Tests: API 661 (service, Drizzle cascade on SQLite, HTTP), web 722 (`delete-page.spec`,
  `privacy-page.spec`). Checked in Chromium at 375 px: sign-in lines, the notice, the delete
  flow to "ลบบัญชีแล้ว" and the mail in the API log.
- **Bundle budget** (owner, 2026-11): the initial bundle is 763 kB (`develop` was already at
  762.1 kB; the notice's text adds 0.9 kB), so the warning budget goes 760 → **800 kB**
  (`web/angular.json`; the error stays at 1 MB).

---

## Done: Shared activity (#21)

Spec: [shared-activity.md](docs/features/shared-activity.md). Web only, no API change: the rows
already carry `addedBy` and `updatedBy`, tombstones included, on the owner's device and in a
member's shared read.

- **Decided at the start** (owner, a mock-up with five screens): "กิจกรรม" after รายการซ้ำ in
  the ⋮ menu; deleted rows only struck through; one colour per person; formal, short wording
  ("การเปลี่ยนแปลงในกระเป๋าที่แชร์ 90 วันล่าสุด", "อดีตสมาชิก"); after the sharing ends the
  activity stays until it is 90 days old, with "เหลือ n วัน" in the menu and a line on the page in
  the last week.
- **Web**: `core/transaction/activity.ts` (`latestAction` and `ACTOR_SQL`, the 1-minute add
  window, the days left); `TransactionService.activityScope()` / `activity()` /
  `setShares()`; `Transaction.updatedBy`; `SharingService.loadOwner` feeds the shared wallets and
  member count; `features/transactions/pages/activity-page` (`/transactions/activity`, ‹ to the
  tab); the list's "แก้ไขโดย / เพิ่มโดย" line for everyone in the share; "สมาชิก" became
  "อดีตสมาชิก". The Transactions tab now reads an own book's members once per book and session
  (it used to only when a row had an unknown `addedBy`), so the ⋮ entry shows for a shared book.
  Initial bundle 772 → 775.5 kB.
- **Tests**: `activity.spec.ts`, the service's activity block (scope, 90 days, ended, the four
  actions), `activity-page.spec.ts`, the header's menu entry and days left, the list's line.

---

## Done: Keypad fills the sheet (2026-11)

Web only, no API change. Owner: the amount keypad looked small, and its height differed between
the browser and the home-screen app (the sheet is `92dvh`).

- `app-calc-keypad` takes `fitBelow` (a selector in its form): it grows up to 12px under that
  row, its four key rows sharing the room (keys at least 44px, the keypad at most 460px). It
  measures again on resize, on the browser bars showing or hiding and when the row's card
  grows. The transaction, transfer and debt entry sheets anchor it to `app-date-row`; the debt
  sheet keeps the natural size (several date rows).
- **Tests**: `calc-keypad.spec.ts` (fitted height, the cap, no anchor).

---

## Done: Edit profile (display name, 2026-11)

Owner: the name on the Settings tab came from the email's local part and couldn't be changed.
Spec: [auth.md](docs/features/auth.md) rule 33 and Web screens → Edit profile.

- **API**: `PATCH /auth/me` `{ displayName }` (trimmed, 1–50, `422` otherwise; no recent auth),
  `authService.updateMe`, `authRepo.setDisplayName`, OpenAPI `updateMe`.
- **Web**: design A (mock-up picked over a separate menu row): the name card on top of the
  Settings tab opens the "แก้ไขโปรไฟล์" sheet (`features/account/components/profile-sheet`);
  `AuthService.updateProfile`, `ApiClient.patch`, i18n `profile.*`. Online only.
- **Tests**: repository, service and HTTP (`auth.*.test.ts`); the sheet, the card and
  `AuthService.updateProfile` (`profile-sheet.spec.ts`, `account-page.spec.ts`,
  `auth.service.spec.ts`).

---

## Done: Profiles are books (2026-11)

Owner: "โปรไฟล์" read as "me" (name, email) as in most apps, but here it was a set of wallets and
categories. The UI says สมุด / Book, and the code, API and docs follow, so "profile" is free for
the user (next: editing the display name). Naming table: `CLAUDE.md` → Naming.

- **UI**: every โปรไฟล์ / Profile became สมุด / Book; Account › สมุด is `/account/books`.
- **API**: `features/book`, tables and columns (`books`, `book_id`), sync table `books`, `bookId`
  on the wire, `/sharing/books/:bookId`, live channel `book:<id>`, error codes (`BOOK_GONE`, …).
  Migration `0021_rename_profile_to_book` renames in place (`ALTER TABLE … RENAME`, indexes made
  again); its snapshot is the old one renamed, and `drizzle-kit generate` sees no changes.
- **Web**: `core/book` (`BookService`), the book sheet, switcher and create step, i18n keys
  `books.*`, device choices under `tpn-book:`. Device schema step 16 renames the local tables,
  columns and indexes and rewrites queued ops and notices.
- **Data**: staging and local were emptied first (beta, nobody else used them), with a one-off
  wipe script that was deleted after use; `scripts/seed-default-categories.ts` went too.
- **Kept as "profile"**: what means the user (`UserProfile`, auth's `profileOf`, Google's
  `openid email profile` scope) and the shipped migrations.

---

## Done: Sign-out asks first (2026-11)

Web only, no API change. Owner: "ออกจากระบบ" on the Account tab signed out at once, and sign-out
wipes the device's data.

- The button opens a bottom sheet (`@defer`red in `account-page`, `app-sheet-frame`): a line on
  what happens (the device's data is deleted, synced data stays in the account), a destructive
  ออกจากระบบ and ยกเลิก. An inline card was tried first; on a phone it sat below the fold.
- Confirming runs the old flow (push first, rule 7); unsynced ops switch the same sheet to the
  "ยังมี n รายการ…" warning. Cancel, ✕, swipe or the backdrop reset it.

---

## Done: Fewer toasts (2026-11)

Web only, no API change. Owner: the toast after adding a transaction covered the header, and the
"sync ไม่สำเร็จ" toast came back on every tab change.

- **Sync failed**: the toast moved from the sync pill to `SyncService.markFailed`, once per streak.
  `app-header` renders the pill in three branches, so a navigation re-created it and each new
  pill toasted again. Sync itself never ran on a navigation; offline and server down still show
  only the pill.
- **Frequent saves**: adding or editing a transaction or a transfer, or paying a card, no longer
  toasts (the list shows the row); "บันทึกแล้วเพิ่มต่อ" still does. Saves done now and then
  (wallet, category, book, debt, event, security) keep theirs (owner's choice). The rule is in
  DESIGN.md §6.
- **Sync sheet wording**: "ทุกรายการ sync แล้ว" shows only after a round got through and while
  nothing is wrong. Never synced, failing, offline or server down, it says "ไม่มีรายการค้างส่งจาก
  เครื่องนี้" instead, so it no longer sits beside the red "sync ไม่สำเร็จ" box.

---

## Done: Account › ติดตั้งลงหน้าจอ (2026-11)

Web only, no API change. [spec](docs/features/install.md). Owner: people didn't know how to put the
app on their phone, and on iPhone only an installed app keeps its local data.

- A settings row between การแสดงผล and เครื่องนี้ opens `/account/install`: installed → it says
  so; otherwise why to install, a one-tap "ติดตั้งแอป" where the browser offers it
  (`beforeinstallprompt`, caught at start by `DeviceStorageService`, which `App` injects), and
  numbered steps for iPhone / Android (segmented, starting on the phone's own).
- Sign-in page (owner, 2026-11, rule 5): a quiet "ติดตั้งแอปลงหน้าจอ" link, hidden in the installed
  app, opens `/auth/install` (the same page in the sign-in layout, `InstallPage` exported by
  `@/features/account`): an iPhone installs first and signs in once, inside the app.
- Not done (owner): a reminder card or banner elsewhere in the app. Check on real phones: the iOS share
  sheet's wording and the ⋯ menu move between iOS versions.

---

## Done: Motion, a number keypad, the ตั้งค่า tab (UI polish, 2026-11)

Web only, no API change. Owner's choices after trying the app on a phone.

- **Motion** (DESIGN.md §8): on the Transactions tab the list slides in from the side of the
  chosen period, by chip or swipe (`appSlide`, `shared/components/slide`); switching bottom
  tabs fades the page in with an 8px rise (`appFadeIn` on the shell's `<main>`,
  `shared/components/fade`). The Reports tab can take `appSlide` the same way (not yet). Inside
  every sheet with views, `appSlide` keyed on the view's depth makes a navigation stack: a
  picker or step slides in from the right, ‹ brings the earlier view back from the left. Sheets
  never ask before closing any more (owner: the forms are short, the question was a nuisance).
  Pages are a navigation stack too: ‹ goes back to the page it was opened from (`NavHistory`;
  the ⋮ menu's debts and รายการซ้ำ return to the Transactions tab, not to Wallets or Settings),
  pages slide in by depth, and the bottom bar keeps the tab a page was opened from lit. To try
  next: events as a view of the Transactions tab instead of their own pages (owner, 2026-11).
  Settings holds settings only: its debts and events rows went (debts: the Wallets tab card and
  ⋮; events: ⋮), and the Wallets tab's debts card moved under the total, one row while nothing
  is owed, so 20 wallets never push it out of sight. The section is called **ยืม-คืน / Loans**
  everywhere (it was หนี้สิน, หนี้ / เงินกู้ and ยืมมา | ให้ยืม at once); one item is still หนี้,
  and adding one says which way ("เพิ่มรายการยืม" / "เพิ่มรายการให้ยืม").
- **The account tab is ตั้งค่า / Settings**: not โปรไฟล์ (then a data set, now สมุด) nor บัญชี (a bank
  account). Its icon is still `lucideCircleUser`.
- **Number keypad** (transaction.md → Web screens): `app-calc-keypad` lost ÷ × − + and "=":
  7 8 9 ⌫ / 4 5 6 C / 1 2 3 ✓ / 0 000 . in 44px rows, in every sheet that uses it
  (transaction, transfer, debt, repayment); ✓ closes it, and it slides up and down
  (`animate.enter` / `animate.leave` on its host, +2 kB gzip to the initial bundle). The
  calculator covered the form, and its "=" read as the save button. A quick amount now adds into the number (`500` → `600`), and a hardware
  keyboard types no operators.
- **No type tabs on the transaction form** (Money Lover style): the category picker has the
  รายจ่าย / รายรับ tabs and the chosen category sets the type; the note box has no placeholder. Together with the keypad, the form gains about
  150px on a phone. The keypad now slides up over the save row instead of pushing it up (all four
  sheets that have it), and the picker's type tabs got 20px under them. **No sheet has a grab
  handle** any more (a global rule in `src/styles.css`): ✕ / ‹ and the swipe close them, and
  each gains 22px.
- **Glass buttons** (iOS style): a sheet's ✕ / ‹ in a glass disc, its header icons in one glass
  capsule, the page header's ‹ in a disc (`tpn-glass`); they were hard to tell from the title.
  Then everywhere such a control floats: the in-page "‹ ตั้งค่า" pills, the Transactions header's
  wallet pill and ⋮, the date row's ‹ ›. All 36px (44px tap, `tpn-hit`) with 18px icons.

---

## Done: Local data on every device, optional PIN, sync failures shown (after 16.2)

- **Decided** (owner, after 16.2; offline-sync rules 1–4 and 7): **every signed-in device keeps
  its data** (local-first, the server is where devices sync and the backup), and **the PIN is
  optional and off by default**. No trust step, no "ใช้งานออฟไลน์" switch, no in-memory
  "untrusted" mode (a device that had it makes its local database at its next open). The app is
  mostly used on phones, which have their own screen lock. Someone else's computer: sign out
  (wipes), or sign it out from another device. PIN off = the data key is kept in `tpn-vault` as a
  `CryptoKey`, the app opens at once and never auto-locks; PIN on = as before (wrapped key, lock
  on open and after 5 min, 5 wrong PINs wipe). Devices that already had a PIN keep it.
- **Decided** (owner, after 16.2; rule 7): an **expired session** goes to sign-in as soon as the
  server says so, the local data kept; offline (or the server down) the app keeps working, since
  signing in isn't possible then. The same user signing in opens the same data and syncs at once
  (push, then pull); another account wipes it first, so the sign-in page says whose data the
  device holds (`auth.localData`). Not wiping on expiry keeps changes made during a long time
  offline. The expired-session banner is gone.
- **Web**: `VaultMeta.key` is `null` with the PIN off and `deviceKey` holds the key;
  `OfflineService.hasPin()`, `enable(pin?)` (one vault however many callers), `open()` (PIN off),
  `changePin()` (also turns it on), `removePin()`, `openInMemory()` (only when browser storage
  refuses the vault), an effect that sends a refused session to sign-in; `shellGuard` makes the
  vault on a first open and opens a PIN-off one itself (one it can't open is wiped); `lockGuard`
  needs the PIN on; the interceptor goes to sign-in on any refused refresh. Removed: the trust
  page and `trustGuard`, `AuthStore.freshSignIn` / `keepsLocalSession`,
  `openUntrusted()`, Security's offline row. `/account/pin` turns the PIN on, changes it, or
  (`?off=1`) turns it off. "Needs online" notices (now only a shared book's) no longer
  mention offline mode. The PIN pad and the amount keypad no longer zoom on a fast double tap
  (`touch-action: manipulation`).
- **Sync failures shown**: a round the API answers with an error (a 500, e.g. a local database
  missing a migration) sets `SyncService.failed()`: the pill shows "sync ไม่สำเร็จ" (red), a toast
  says so once per streak (from `SyncService` since "Fewer toasts"), the sheet explains, and it retries like an unreachable server. Before,
  it only logged to the console and looked synced.
- **Known**: two `sync.service.spec.ts` retry tests ("while the server is unreachable") fail now
  and then, on `develop` before this change too (timer timing); not fixed yet.
- **Left for later**: the auto-lock time with the PIN on (at once / 1 / 5 / 15 min), passkey
  unlock (Backlog). The 180-day session cap stays (a sign-in every 6 months, data kept).

---

## Done: Shared components refactor (16R)

One PR, no behaviour change. The owner's rule: components that do the same job move to
`shared/components/<group>/` (web/AGENTS.md §2); ones that only partly match stay where they are.

- `shared/components/date-row` (`app-date-row`): the debt, event, transaction and transfer sheets'
  date row (was the debts' component, a copy in events and inline markup in the two layout sheets).
  The sheets pass `today` and `locale`; `ariaLabel` keeps the transaction form's "วันที่".
- `shared/components/wallet-pick` (`app-wallet-pick`, `WalletPickItem`, `walletPickItem()`): the
  debt sheets' picker, the transfer sheet's `pick` view and the transaction sheet's `wallet` view
  (no balance or note there). The sheets format the rows; `empty` is the no-wallet line.
- Checked and left alone (they differ): the debts' `category-pick` (one feature; the transaction
  sheet's tree looks different), the Reports summary card (another design from `money-summary`),
  the day cards (rows differ per page), the wallet-corner badge, `shared/components/repeat-row`.
- Verified: initial total still 737.4 kB, neither component in `main`; Playwright before/after
  (th/light, en/dark, 375×812) identical to the pixel; 648 web tests.

Known, for later:

- The initial bundle is **763 kB** after #22 (warning budget 760 → 800 kB, owner 2026-11). It
  was **750.6 kB** after the one book switcher (2026-11; warning budget
  750 → 760 kB: the Wallets tab header took the three-column layout). It was 737.4 kB after
  16.2: 16.1's Thai translations
  (`th.json` is an initial chunk) and 16.2's shell pieces (switcher group, shared-book step,
  TEMP tables). Keep new screens lazy and their services out of
  the shell (#12 loads `RecurringService` and 16.1 `SharingService` with a dynamic `import()`
  after the shell's first render; `DebtService` and `EventService` are injected only by their
  pages; `core/transaction` reads `events` by name). A module exported from a barrel the shell
  imports lands in the initial bundle even when only a lazy screen uses it (Angular builds keep
  a barrel's modules): keep such code beside its screen (#15's
  `sheets/category-move/category-move-rows.ts`).
- Headless Chromium breaks some Thai lines inside a word ("บัน/ทึก"); the app's older notices do
  the same, so it's the test browser's line breaking, not our markup.
- The API's sign-in only accepts `Origin: http://localhost:4200` (`WEB_ORIGIN`): a local server
  for Playwright on `npm run build` output must listen on 4200, or `/auth/refresh` answers 403.
- **Old service worker on a tunnel** (2026-11): a phone that once opened a `npm run build` copy
  on a tunnel host keeps that build's service worker, which serves the old app even when the
  host now runs `ng serve` (no worker there). It goes by itself after a while (`ngsw.json`
  answers 404, so the worker drops its caches and unregisters), or at once by deleting the
  host's Website Data in Safari's settings. Use different hosts for build and `ng serve`
  (a quick `*.trycloudflare.com` for builds).
- **API tests on Windows from Git Bash** (2026-11): with a lowercase drive in the path (`d:\…`,
  as Git Bash gives) Vitest loads two copies of itself and every file fails ("failed to find the
  runner", "reading 'config'"). Run `npm test` from PowerShell or another terminal on `D:\…`.

---

## Done: Family sharing 16.2 (#16)

- **Decided at the start** (owner, two mock-up rounds, `docs/features/mockups/sharing-16.2.html`):
  a book shared with you is a **"แชร์กับฉัน" group in the book switcher** and works like an
  own book (the same tabs, one ➕, the same transaction sheet), **online only**: offline (or
  the server down) the group is disabled and a shared book in use shows a blocked screen.
  This replaced 16.1's Wallets tab section and `/wallets/shared/:id`, and offline-sync rule 14's
  offline adds (no member outbox, no "รอ sync"). Editors add, edit and delete any income /
  expense row of the shared wallets; a viewer reads. The owner wins even over an editor's delete
  (the row comes back). Reports and the book's own setup pages (categories, rules, debts,
  events, export, sharing) show a note in a shared book.
- **Decided while building**: an editor's write goes through `POST /sync/push` at once (the
  feature's own validation, as the owner), `STALE` / `NOT_SHARED` refusals; `addedBy` is set by
  the server only; transfers and debt entries aren't listed for a member, their money is folded
  into the wallet's `initialBalance`; the member's read is `GET /sharing/with-me/:id/rows`, a
  pull-like read with transactions as columns + rows (20,000 rows ≈ 4 MB instead of 10).
- **API**: migration `0019_transactions_added_by`; `core/database/wallet-access`; sync's
  `SyncPushHandler.shared` hook (transactions) and the editor / owner-wins rules in
  `sync.service`; 16.1's `/sharing/wallets/*` routes gone. **Web**: schema step 14; TEMP shadow
  tables (`LocalDatabase.createShadows`, `OfflineService.enterShared` / `fillShared` /
  `leaveShared`, own sync paused, `SyncService.pushShared`); `BookService.shared`;
  `SharingService.openShared` / `refreshShared`; `layout/shared-book-step`; "เพิ่มโดย …".
- **Checked**: Playwright at 375×812 on `npm run build`, owner th/light and member en/dark, a
  shared book of 20,000 rows (open ≈ 2.4 s, another month ≈ 0.3 s): editor add / edit of the
  owner's row / delete stored as the owner's with `addedBy` / `updatedBy`; owner offline vs editor
  on one row (owner wins); a stale editor edit (`STALE`, reload); editor delete vs owner offline
  edit (row back); two owner devices on one row (later edit wins, notice); member removed while
  the book is open (`NOT_SHARED`, back to own); viewer read only; offline blocked; own sync
  after leaving. Tests: API 631, web 648.
- **Known**: a row the owner moves out of the shared wallets stays in the member's view until the
  book is opened again (incremental reads go by wallet); a shared book in use is read again
  every minute, on coming back online and after a refusal; a trusted device's service worker
  serves the previous build once after a deploy (the usual update banner).

---

## Done: Family sharing 16.1 (#16)

- **Decided at the start** (owner, two mock-up rounds, `docs/features/mockups/sharing.html`):
  #16 in two parts. Sharing is managed in **Account › แชร์กระเป๋า** for the **current book**
  (not in the wallet sheet or a ⋮ menu): an invite is per **person**, with **one role** for all
  the wallets shared with them and every open wallet switched on by default; a new wallet is
  **not** shared automatically (the page shows a card for wallets shared with nobody). The
  member answers invites and leaves (all of one owner's book) on the same page, and sees
  balances in a "แชร์กับฉัน · ของ …" section of the Wallets tab, then `/wallets/shared/:id`.
  Shared wallets count in **no** total or report of the member. In 16.1 every member is
  read-only; the role is stored and shown.
- **Decided while building**: invites match the verified `users.email` when read (no attach
  step at sign-in); `wallet_invites` is server only, its expired rows are ignored everywhere
  and deleted on the next invite (no cleanup job); one invite holds a set of wallets; a member
  sees a wallet while it is live, open and on a live book (archived = gone for them); the
  entries hide the other wallet of a transfer and the debt of a debt entry; the mail's link only
  fills the email in on sign-in (`?email=`); a shared wallet's page has no book switcher and
  skips the first-wallet step (`isBookTab` / `isWalletTab` leave `/wallets/shared/` out).
- **API**: `features/sharing` (REST only, Drizzle adapter reading other features' tables through
  the schema, its own `hitRateLimit` on `rate_limit_buckets`), migration `0018_wallet_invites`,
  11 routes in OpenAPI. **Web**: `core/sharing` (`SharingService`, memory only, cleared when the
  user changes), `features/account/pages/sharing-page` (+ `share-sheet`),
  `features/wallets/pages/shared-wallet-page`, the Account row with an invite badge and a dot on
  the Account tab.
- **Checked**: API end to end with two users (every rule and code); Playwright at 375×812 on
  `npm run build`, owner th/light and member en/dark: invite → dot → accept → Wallets tab →
  shared wallet of 20,000 rows (first rows in ≈ 0.2 s, another month in ≈ 0.05 s),
  `setOffline` (the read data stays with a notice, actions disabled), role and wallet change and
  removal seen by the member on the next read. No two-device case: nothing in 16.1 writes the
  same row. Tests: API 616, web 626.
- **Known**: the member limit (10 people) is reached before the daily send limit (10) with fresh
  invites, so the daily limit mostly guards resends; a failed send still counts toward the limits.

## Done: CSV export + move transactions (#15)

- **Decided at the start of #15** (owner, after a first mock-up of search / filters / a select
  mode): **no search, no filters** in the Transactions tab or Reports and **no event filter**
  (event.md Q10): the tab browses by period and Reports by category, and the event page lists
  its rows. What stays: a **CSV export** in Account (dates, wallets, categories, each "all" by
  default) and **moving a category's transactions** (all, or one wallet's, with "hide the old
  one there") from the category sheet, with undo. Mock-up `docs/features/mockups/export.html`
  (reviewed).
- **Decided while building**: the export includes debt entries with the transfers (the switch is
  "รวมการโอนเงินและหนี้สิน"); the file name keeps only ASCII (Chromium drops a Thai download
  name); a conflict with another device's later edit gives the usual notice per row (not one
  grouped notice).
- **Web**: `features/account/pages/export-page` (`export-data.ts` reads the tables by name,
  `csv.ts`, the pick sheet; Web Share on touch devices, a download elsewhere);
  `sheets/category-move` + `category-move-rows.ts` (a view of the category sheet; one write
  of row upserts, undo from the toast); `app-sheet-frame` takes `actions` (2 | 3 | 4) instead
  of `threeActions`. No API change, no OpenAPI change.
- **Checked**: Playwright at 375×812 on `npm run build`, th/light with 20,000 rows + 300
  transfers: export of 20,600 rows in ≈ 0.3 s (BOM, quoting, the formula guard), a custom range
  with some categories (4,534 rows, as computed from the seed), moving 2,857 rows in ≈ 0.5 s
  with hide and undo, `setOffline` (export, then moving 3,333 rows in ≈ 0.6 s; synced 16 s after
  coming back); en/dark (one wallet, the four-icon sheet header); two devices of one user (A
  moves 100 rows offline, B edits one of them later: B's edit wins that row, 99 moved, A gets
  one notice). Tests: web 611. Initial bundle 729.3 kB.
- **Known**: many conflicting rows give one notice each; the export reads every chosen row into
  memory at once (fine at 20,000).

## Done: Event / trip (#14)

- **Decided at the start of #14** (owner: "ตามเสนอ" on Q1–Q12, event.md): its own `events`
  table and `transactions.eventId`, one event per row (Q1); name, icon / colour, start and an
  optional end, "จบทริป" / "เปิดอีกครั้ง" (Q2); per book, across wallets, totals per
  currency (Q3); income and expense only, not transfers or debt entries (Q4); totals of every
  tagged row, report or not (Q5); pages under `/transactions/events` from the ⋮ menu and
  Account, an "อีเวนต์" row in the form, a tag on the list's rows (Q6); the default is the open
  event whose dates hold the form's date, nothing stored for an "active" event (Q7); rules carry
  no event (Q8); delete asks first, rows stay (Q9); no event filter until #15 (Q10); 50 open
  per book (Q11); a Thai / dark mock-up `docs/features/mockups/event.html` (Q12; built
  without the owner's review of it, see Next).
- **Decided while building** (owner: confirmed from the screenshots): **delete writes only the
  event's tombstone**. Untagging its rows in the same write lost another device's offline edit
  of one of them (later edit wins the whole row: a note was gone); now rows keep `eventId`, no
  screen reads a gone event, and the server clears the link when such a row is pushed again.
- **API**: migration `0017_events` (`events`, `transactions.event_id` without a FK);
  `features/event` (one handler: live book, book fixed, end not before start, 50 open);
  `core/database/event-link.ts` (`checkEventLink`, read by the transaction handler: other
  book refused, gone cleared in `resolve`); OpenAPI `SyncEventRow`, `eventId`.
- **Web**: local schema step 13; `core/event` (`EventService`); `core/transaction` reads `events`
  by name (`eventOptions`, `defaultEventId`, `liveEventId`, `eventName`, `ListFilter.eventId`);
  `features/events` (list, event page with rows 100 at a time, sheet); the form's event row and
  picker; the ⋮ menu and Account rows; the book delete confirm counts events; sync sheet
  name and fix route.
- **Checked**: an HTTP script on `/sync/push` + `/pull` (shapes, an end before the start, the
  limit, other book, a gone event cleared). Playwright at 375×812 in th/light and en/dark on
  `npm run build`: totals (10,090 = 8,400 + 450 + 1,000 + 240), "เพิ่มรายการ" tagged, the
  default by date (today → เชียงใหม่, 15 Oct → งานแต่ง, × kept across date changes), finishing
  the trip moves the default, create and delete; `setOffline` (an event and a tagged row made
  offline, synced 0.12 s after); two devices of one user (B edits a tagged row offline while A
  deletes its event: B's note kept, the link cleared, both agree); 20,000 rows (event.md →
  Volume). Tests: API 591, web 591. Initial bundle 726.9 kB.
- **Known**: an event's totals ignore its dates (a row tagged by hand outside them counts);
  rows of a deleted event keep its id on the server until they are edited.

## Done: Debt / loan (#13)

- **Decided at the start of #13** (owner: "ตามเสนอ", round 1 of the mock-up
  `docs/features/mockups/debt.html`; debt.md → Open questions): counted once, **a choice per
  debt** when it is created ("ตอนใช้เงิน" or, borrowed only, "ตอนผ่อนคืน"), never changed (Q1);
  **own tables** `debts` + `debt_entries`, not a kind of wallet (Q2); borrowed / lent, the person
  a free name (Q3); uncounted money as entries shown like transfer sides, counted money
  (instalments of a repaid debt, interest, a forgiven rest) as ordinary transactions with
  `debtId` (Q4); interest an amount in the repayment sheet (Q5); closed computed, "ปิดหนี้" with
  the rest or forgiven (Q6); instalments as a #12 rule (Q7); ยอดรวม unchanged, a "หนี้สิน" card
  on the Wallets tab, a "หนี้" line on the summary card, reports' balances only (Q8); the Wallets
  tab card, the ⋮ menu and Account rows, pages under `/wallets/debts` (Q9); locks, merge and
  sweeps (Q10); delete asks first, entries and rules go, counted rows stay (Q11); 100 open
  debts per book, due dates with overdue in red (Q12).
- **Decided while building** (owner: "ยืนยัน", from the screenshots): a forgiven rest is **two
  rows in one wallet** (an uncounted repayment that settles + the counted transaction), since a
  single counted row would take the money out of the wallet twice, so only a repaid debt's
  instalments settle a debt among linked transactions; "ผ่อนเป็นงวด" monthly only; a `debt`
  rule's schedule isn't edited on the debt's page; a category used by a debt refuses delete with
  the usual "มีธุรกรรมแล้ว" line.
- **API**: migration `0016_debts` (`debts`, `debt_entries`, `transactions.debt_id`,
  `recurring_rules.debt_id`); `features/debt` (two handlers: fixed direction / countAs /
  currency, an expense category for repaid, 100 open per book, an entry's wallet in the debt's
  currency and none only on a repaid debt; `resolve`: a merged category, an entry of a deleted
  debt goes with it; `keepsStored` for recorded repayments); `core/database/debt-link.ts`
  (`checkDebtLink`, read by transactions, rules and entries); a transaction's link to a gone debt
  is cleared, not refused; recurring `kind` `debt` and `debtId`; an entry fixes a wallet's
  currency, a debt its category's type, a category merge moves debts; OpenAPI `SyncDebtRow`,
  `SyncDebtEntryRow`, `debtId`.
- **Web**: local schema step 12; `core/debt` (`DebtService`: items with total / paid / left /
  interest / closed / forgiven / overdue in one query, history, create with a plan, edit, fix,
  delete, entries with interest, close, people); `core/wallet/debt-tables.ts` (table names and
  the entry-sign / settles / left SQL); balances, `hasTransactions`, the Transactions tab's rows
  (`DebtEntryItem`, `kind: 'debt'`), `MoneySummary.debt`, reports' balances and chip; sweeps of
  orphaned debts and entries; recurring `kind` `debt`, a closed debt stops its rule;
  `features/debts` (list and debt pages, debt / entry / close sheets, wallet and category
  pickers, a date row); the Wallets tab card, the ⋮ menu and Account rows; the transaction form's
  "หนี้" row and `debtId` kept on edit and copy; the sync sheet's fix routes and names.
- **Found and fixed while building**: the debt and entry sheets' validators read fields made
  after the form (they run while it is built), so the entry sheet threw and never opened (a page
  spec opens it now); the first close design moved the wallet twice for a forgiven rest (a spec
  fails without the fix).
- **Checked**: an HTTP script on `/sync/push` + `/pull` (26 checks: shapes, fixed fields,
  categories, currencies, merge, a late entry of a deleted debt, a cleared link, debt rules, a
  duplicate recorded repayment). Playwright at 375×812 in th/en × light/dark on `npm run build`
  with the mock-up's family: balances (cash 8,820 / bank 71,210, owed 54,000), KTC's three
  instalments recorded at open, a repayment, a repayment with interest, a lent debt created and
  forgiven (the wallet unmoved, the expense counted once), an instalment debt with a 4-month
  plan; `setOffline` (synced 0.26 s after) and the API really stopped ("เซิร์ฟเวอร์ไม่ตอบ · รอ
  1", synced by itself 16.3 s after it came back); two devices of one user: A deletes a debt
  while B offline gets money back on it (B's entry goes with the debt, both wallets agree at
  10,820), and both rename one debt (the later wins, B is told); 20,000 rows (debt.md → Volume).
  Tests: API 585, web 571. Initial bundle 723.7 kB.
- **Known**: a repaid debt's repayment sheet offers no interest (its instalments carry it); a
  forgiven rest shows as two rows (noted "ยกหนี้") in the Transactions tab.

## Done: Recurring transactions (#12)

- **Decided at the start of #12** (owner: "ตามเสนอ", round 1 of the mock-up
  `docs/features/mockups/recurring.html`; recurring.md → Open questions): the **device** records
  due occurrences when the app opens (after the first sync round, or at once offline), each rule
  **"บันทึกให้อัตโนมัติ"** or **"ถามก่อนบันทึก"** (a due card to record, edit or skip) (Q1);
  **deterministic occurrence ids** + the server keeping its row for a second create, quietly,
  and `nextOn` only moving forward (Q2); day / week / month / year with "every n", the 31st →
  the month's last day, an end by date or count (Q3); transfers repeat too (Q4); a "ทำซ้ำ" row
  under "เพิ่มเติม", Account › รายการซ้ำ + a ⋮ row, the due card, upcoming rows in "อนาคต" (Q5);
  an edit changes what isn't recorded, delete of an occurrence = skip (Q6); an archived wallet
  or category stops a rule (no catch-up), a merge moves it, a delete takes it, a live rule fixes
  currency and type (Q7); 3 months of upcoming, never counted (Q8). Extras: the toast after a
  pass, no "save and add" while repeating, 100 rules per book.
- **Decided while building** (owner, from screenshots): no undo on a due item's "บันทึก" /
  "ข้าม"; one device's skip beats another's record of the same due item (one notice); the rules
  page's add buttons under the list; the transfer form's "ทำซ้ำ" in its own card.
- **API**: migration `0015_recurring` (`recurring_rules`, `recurring_id` on transactions and
  transfers); `features/recurring` (checks, 100 per book, `resolve`: a merged category and
  `nextOn` only forward, `sameChange`); the sync service's optional hooks `keepsStored` (a
  create of an id the server has keeps its row, answered `overridden` with no notice) and
  `sameChange` (no notice between versions that are the same change); a category merge's
  `followUp` moves its rules; a live rule fixes a wallet's currency and a category's type;
  `isCalendarDay`; OpenAPI `SyncRecurringRuleRow`, `recurringId`.
- **Web**: local schema step 11; `core/recurring` (`RecurringService`: the recording pass in an
  effect after `SyncService.rounds()`, due / confirm / skip / confirmAll, update / pause /
  remove, `upcoming`, sweeps; `schedule.ts`; `occurrence-id.ts` (SHA-256 in plain JS, a UUID v8);
  `describe.ts`); the shell loads it with a dynamic `import()`; `sheets/repeat-view`,
  `shared/components/repeat-row` and the `rule` / `fixRule` modes of both sheets; Account ›
  รายการซ้ำ; the due card and `components/due-sheet`, upcoming rows and the ↻ mark on the
  Transactions tab; wallet / category / book delete take or count rules; the sync sheet's fix route.
- **Found and fixed while building**: the recording pass opened a write for a due ask-first
  rule though it wrote nothing; the write re-ran the pass, so the page hung in a loop (a spec
  hangs without the fix).
- **Checked**: an HTTP script on `/sync/push` + `/pull` (a duplicate create keeps an edited and a
  skipped row, no notice; a stale `nextOn` stays forward; merge moves rules; type and currency
  locks). Playwright at 375×812 in th/en × light/dark on `npm run build`: a seeded family's rules
  recorded at open (the 31st → 30 Nov; an archived wallet's rule skipped ahead), the due card,
  sheet and edit-before-record, "อนาคต", the menu, the rules page and sheet, a rule from the
  form; two devices of one user offline across midnight (Playwright clock) recording the same
  occurrences: one row each on the server, A's edit kept, both rules on the same next date;
  `setOffline` and the API really stopped ("เซิร์ฟเวอร์ไม่ตอบ · รอ 2", synced by itself 13.9 s
  after it came back); 20,000 rows (recurring.md → Volume). Tests: API 569, web 549. Initial
  bundle 716.8 kB.
- **Known**: a rule's "บันทึกแล้ว n ครั้ง" counts its rows without an index (fine for one rule
  at a time). Reminders / push notifications wait for #17 (no server job before deploy).

## Done: Reports (#10)

- **Decided at the start of #10** (owner, three rounds of the mock-up
  `docs/features/mockups/report.html`; report.md → Open questions): by category as a thin
  split bar over a ranked list with bars (Q1-B), drawn with our own elements, **no chart
  library**; month (default) / quarter / year / custom through the ⋮ "ดูตาม", its own choice
  kept per book, trend 6 months / 4 quarters / 5 years (Q2); the Transactions tab's wallet
  switcher and chosen wallet (Q3); money on a parent itself as "ไม่ระบุหมวดย่อย" (Q4); drill-down
  pages in the tab, rows open the transaction sheet (Q5); one currency at a time with chips
  only when needed (Q6); no API (Q7); extras ยอดเริ่มต้น / ยอดสุดท้าย (owner's wording),
  average per day, the previous period on a category page, the "ไม่รวมในรายงาน" line and page,
  not the % against the previous period; the summary card **H1** (S3's net headline and tinted
  tiles + S1's balances on one line + small chips).
- **Decided while building** (owner, from screenshots): the previous period named by its
  dates ("เทียบกับ ก.ย. 2026: 1,135.00", not "เดือนที่แล้ว", which is also a chip); a wallet with
  only transfers shows its summary (its balances moved); a category page lists only counted
  rows; no "อื่น ๆ" fold; the chips stay on the report pages.
- **Found and fixed**: the Transactions tab jumped back to "เดือนนี้" (and its remembered
  wallet) after any save or pull while another period was chosen (since 8.1):
  `BookService.current()` is a new object after every write or pull, which re-ran the
  effect that restores the view. `BookService.currentId()` now feeds it (and the report's);
  a spec fails without it.
- **Web** (no API change): `core/report` (`ReportService`: unit / tab / custom / type /
  currency, `summaries`, `breakdown`, `byCategory`, `categoryTotal`, `trend`,
  `previousRange`, balances as one `UNION ALL` aggregate); `features/reports` (the tab, the
  category and left-out pages, `components/` summary card, trend, share list, day list,
  `report-view.ts`); `TransactionService.list` filter; `layout/transactions-header` `view`
  input (`app-header` shows it on `/reports`, `parentOf` goes up a report page, the
  `PageTitleStrategy.setOverride` title); `shared/components/period` (`app-period-strip`,
  `appSwipe`, `app-custom-range-sheet` with `range` / `applied`, now used by both tabs).
- **Checked**: Playwright at 375×812 in th/en × light/dark on `npm run build` with a seeded
  family (Oct: 151,625 + 21,569 − 5,000 transfer − 1,500 left out = 166,694); the bar tap, the
  left-out page, a parent, "ไม่ระบุหมวดย่อย" and a child, quarter / year / custom, the savings
  wallet; `setOffline` (an edit moves the totals at once, synced 0.3 s after) and the API
  really stopped ("เซิร์ฟเวอร์ไม่ตอบ · รอ 1", synced by itself 15.6 s after it came back, its
  boot included); 20,000 rows (report.md → Volume: the tab ≈ 0.12 s, a period 0.09–0.15 s, a
  year of one category ≈ 0.28 s; the Transactions tab again: month ≈ 0.10 s, "ทั้งหมด" ≈ 0.47
  s). Tests: web 511 (API unchanged, 544). Initial bundle 713 kB.
- **Known**: several currencies are built but only seen in specs (only THB is active).
- **Changed after #10** (owner, 2026-11): the trend no longer shows the periods before the
  chosen one (data from outside the chosen month confused the tab, and a bar tap that moved
  the period shifted the bars under the finger): it splits the chosen period into its months
  (quarters or years for a long custom range), none for a month, and a tap shows a bar's
  figures (report.md rule 7). The summary card leads with รายรับ / รายจ่าย, the net one line
  under them, and the breakdown comes before the trend.

## Done: Category merge (7.3)

Done before Reports, so retiring a category doesn't mean moving its transactions one by one (a
category with transactions could only be archived, category rule 6). **7.3 added "ผสาน"**
(category rule 15): move a category's transactions to another one of the same type, then
delete it, from the category form in Account › หมวดหมู่ (a header icon beside archive /
delete, views in the same sheet).

- **Decided at the start of 7.3** (owner; category.md rule 15, mock-up
  `docs/features/mockups/category-merge.html`): a category merges into **any** category of the
  same book and type, top-level or sub-category, except itself and its own children (as in
  Money Lover: "ค่าน้ำ" into "ค่าข้าว" or into "อาหาร"); a parent's children move under the
  target (or the target's parent) with a name clash merging, or all merge in; a confirm view,
  no undo; merged ids leave `hiddenCategoryIds`; the "can't delete" line offers the merge.
- **Sync, decided** (owner): the device merges locally and queues **one** op (the tombstone
  with `mergedIntoId`); the **server** moves the transactions (and leftover children) when it
  lands, and moves a late transaction pushed to the merged category instead of refusing it. No
  network needed to merge. A merge only meets a row it didn't move when one user's two devices
  are both offline (later-edit-wins can't settle it: different rows), so shared wallets (#16)
  stay on the roadmap.
- **Also decided**: archived source ok, target open; refused child moves merge into the
  target; the target keeps its own hidden state; confirm, no undo. A per-wallet move is #15's
  bulk edit, not a merge.
- **Built** (PR #26) and **tested** (the follow-up PR):
  - API: migration `0014_category_merged_into`; the sync service's optional handler hooks
    `resolve` (a pushed row adjusted before its checks) and `followUp` (rows a written row
    implies, with a block of `changeSeq`s from `takeSeqs(n)`); `core/database/category-merge.ts`
    `findMergeTarget` (≤ 5 hops, same owner, book and type); a merged tombstone moves its
    transactions (one `UPDATE … FROM`) and merges leftover children; a late transaction, or a
    child pushed under a merged parent, follows the merge instead of being refused.
  - Web: local schema step 10 (`categories.merged_into_id`), `core/category/category-merge.ts`,
    `CategoryService.merge` / `mergePlan` / `mergeTargets` / `transactionCount`, both sweeps run
    `followMerges` first, the sheet's merge icon and `merge` / `confirmMerge` views, the
    can't-delete line with a merge link, `app-sheet-frame` `threeActions`.
  - Checked: a scenario script on the real push service (1,200 transactions merged in one op,
    23 ms; a late push and an offline child follow; a chain of merges; leftover children).
    Playwright at 375×812 on `ng serve` with the API: กาแฟ → ร้านอาหาร (17 rows, total
    unchanged), ที่อยู่อาศัย → ช้อปปิ้ง in both modes (a clash merges into ค่าไฟ, a moved child
    keeps its hidden state), dark mode; the server's rows checked after.
  - Two devices in the browser (Playwright, `ng serve` + the API): B trusted and offline adds
    to กาแฟ while A merges กาแฟ → ร้านอาหาร; B back online shows all four rows on ร้านอาหาร
    (its pending op was moved by the server, then pulled), nothing deleted, the server agrees.
  - Tests: API 544 (sync hooks, `takeSeqs`, `findMergeTarget`, both handlers, the schema),
    web 479 (`category-merge`, `CategoryService.merge`, the transaction sweep, the sheet);
    OpenAPI `SyncCategoryRow.mergedIntoId`.
- **Known**: a child move refused for a clash another offline device made (the server then
  merges that child into the target) stays in the sync sheet as a refused item until it is
  discarded; its "fix" opens a category that is gone. Rare; not handled.

## Done: Transfer (#9)

- **Decided at the start of #9** (owner, from two rounds of HTML mock-ups, transfer.md → Open
  questions): a `transfers` table of its own, one row per transfer, shown as two rows (Q1); the
  same currency only (Q2); no fee field, a fee is its own expense (Q3); its own sheet, opened
  from the ⋮ menu, now a two-level nav list "โอนเงิน · ดูตาม ›" (choice B, more items will
  join), and from the Wallets tab (Q4); two rows, the outgoing one first, **red − / green +**
  with "โอนไปยัง" / "ได้รับจาก" (Q5, replacing DESIGN.md §5's neutral transfers); editing or
  deleting either row changes the whole transfer (Q6); the to wallet remembered per from wallet
  (Q7); a "โอน" summary line when the view's transfers don't cancel out; the book delete
  counts transfers with transactions.
- **Decided while building** (owner): the sync status is the **icon on every tab** (it was a
  word pill outside the Transactions tab); the Wallets tab's "โอนเงิน" is tinted gold so it
  doesn't look like the outline "เพิ่มกระเป๋าเงิน" (maia's `secondary` looked the same);
  "Transactions" stays the English tab label.
- **API**: migration `0013_transfers` (book and both wallet FKs with cascade),
  `features/transfer` (sync handler; `check`: the user's live book with no move, two
  different live wallets of it, archived accepted, the same currency); a wallet on either side
  of a live transfer keeps its currency; `isEntryDay` in `shared/utils` (transactions and
  transfers); OpenAPI `SyncTransferRow`.
- **Web**: local schema step 9, `SYNC_TABLES`, `BOOK_CHILD_TABLES`; `core/transaction`
  `TransferService`, `TransactionService.entries` / `transferSides`, `MoneySummary.transfer`;
  balances and `hasTransactions` count both sides, a pulled wallet tombstone takes its
  transfers; `sheets/transfer-sheet`; the ⋮ menu's two levels; the Wallets tab button; the sync
  sheet's refused transfer; `CALC_KEYBOARD` shared by both sheets; `app-sync-status` icon only.
- **Found and fixed**: the transaction form never dropped a category the newly chosen wallet
  hides (since 8.1: a control's `valueChanges` read a `computed` fed by the form's, which hadn't
  emitted yet; `web/AGENTS.md` → Forms); the sync sheet had no name for the transfers table.
- **Checked**: curl-style scripts on `/sync/push` + `/pull` (every check above, amount, date and
  note limits, USD switched on for the currency rules, delete then the currency is free).
  Playwright at 375×812 in th/en × light/dark on `npm run build`: add through the ⋮ menu (the
  error, the pickers, `500+500`), the two rows in "ทุกกระเป๋า" and one wallet (กสิกร: "โอน
  −9,000"), edit from the incoming row (both sides 500), delete + undo (both rows), a transfer
  to the excluded savings from the Wallets tab (ยอดรวม unchanged by internal transfers, −5,000
  line), the remembered to wallet; `setOffline` (synced 0.5 s after) and the API really stopped
  ("เซิร์ฟเวอร์ไม่ตอบ · รอ 1", synced by itself 1.5 s after it came back); an untrusted device
  offline can't save. Tests: API 527, web 464.

## Done: Transaction 8.2 (#8)

- **Decided at the start of 8.2** (owner, from an HTML mock-up): **quick amounts** as a chip row
  `20 · 50 · 100 · 500 · 1,000` at the top of the keypad's panel (keys 4px shorter), a chip
  **adds** (`500` then `100` → `500+100`), a fixed set with an on/off switch per device in
  Account › การแสดงผล (on by default); **toasts at the top** of the screen everywhere; and the
  extras the owner picked: "ใช้บ่อย" categories (a shortcut row above the tree, the tree keeps
  the user's order, so frequency and reordering don't fight), copy, save and add another, the
  last type remembered.
- **Decided while building** (owner): the keypad belongs to the amount row: it opens with it
  when adding and closes when any other control of the form is used (type tabs, date,
  เพิ่มเติม), not only the picker rows.
- **Found while building**: a toast never showed over an open sheet: CDK put overlays in the
  browser's top layer (popover), above any z-index, so toasts were drawn under the sheet's
  backdrop (8.1's "stacked toasts cover the keypad" was really this). Now `OVERLAY_DEFAULT_CONFIG`
  `usePopover: false` (`app.config.ts`) and the toaster lives beside `<body>` (`app.ts`), so a tap
  on a toast doesn't close the sheet and the sheet's `aria-hidden` doesn't hide it.
- **Web** (no API change): `shared/utils` `addQuickAmount`; `app-calc-keypad` `quickAmounts` /
  `quickPressed`; `core/transaction` `QuickAmountsService` (`tpn-quick-amounts`),
  `frequentCategoryIds()`, `lastType()` / `rememberType()`, `TransactionSheetState` create with
  `values` / `type` (copy); `sheets/transaction-sheet` (chips, ใช้บ่อย, copy, save and add,
  `leaveAmount`).
- **Checked**: Playwright at 375×812 in th/en × light/dark on `npm run build` (chips, `500+100 =
600.00`, save and add, ใช้บ่อย order with ties, copy dated today, the last type, the switch
  off = 8.1's keypad, delete + undo tapped over an open sheet, the ⋮ menu and wallet sheet after
  the overlay change, the keypad closing on other controls); `setOffline` (2 rows queued, synced
  0.5 s after) and the API really stopped ("เซิร์ฟเวอร์ไม่ตอบ · รอ 2", synced by itself 17 s
  after it came back). Tests: web 439 (API unchanged, 512).

## Done: Transaction 8.1 (#8)

- **Decided at the start of #8** (owner, transaction.md → Open questions): the Money Lover
  header comes in 8.1 (no temporary month stepper); no time of day (a day's rows by
  `createdAt`); pickers leave archived wallets and categories out, the server accepts them; a
  pulled wallet or category tombstone takes its live transactions; an on-screen calculator
  keypad; "ทุกกระเป๋า" leaves out wallets excluded from the total; `excludeFromReport` kept; a row
  opens the form.
- **Decided while building** (owner, from HTML mock-ups and Money Lover screenshots): **ค.ศ. in
  the whole app** (replaces the locked พ.ศ. in Thai); the form has no labels above its rows, the
  note is its own view, "ไม่รวมในรายงาน" folds under เพิ่มเติม; the list's day cards (big date,
  weekday, month ค.ศ.), chip tabs `09/2026 · เดือนที่แล้ว · เดือนนี้ · อนาคต` and only the chosen
  period's rows; the wallet switcher in the very centre, so the sync pill is an icon on this tab;
  the wallet's badge on the category badge on "ทุกกระเป๋า" (ก); sub-categories in a panel tinted
  with the parent's colour (3+4, also in Account › หมวดหมู่ and "หมวดหมู่ที่ใช้"); the initial
  bundle warning budget 680 → 750 kB (694 kB; features after #8 are lazy).
- **API**: migration `0012_transactions` (book, wallet, category FKs with cascade),
  `features/transaction` (sync handler; `check`: the user's live book with no move, live
  wallet and category of that book, no move to another currency); wallets keep their
  currency and categories their type while they have live transactions; OpenAPI
  `SyncTransactionRow`.
- **Web**: local schema step 8 (+ `(book_id, occurred_on)`, wallet, category indexes),
  `SYNC_TABLES`, `BOOK_CHILD_TABLES`; `core/transaction` (`TransactionService`, `period.ts`);
  real `balance()`, `hasTransactions` / `canChangeCurrency` / no delete in `WalletService` and
  `CategoryService`; `layout/transactions-header`, `view-wallet-sheet`, `custom-range-sheet`,
  `transaction-sheet`; `features/transactions`; shared `calc.ts`, `day.ts`, `formatAmount`,
  `app-calc-keypad`, `app-calc-amount-field`, `.tpn-tree`; ➕ opens the sheet.
- **Checked**: curl-style scripts on `/sync/push` + `/pull` (amount and date limits, foreign /
  deleted / other-book wallet or category, archived accepted, currency move with USD switched
  on for the test, currency and type locks, two devices: the later edit wins). Playwright at
  375×812 in th/en × light/dark on `npm run build`: add with the keypad (`120+65` → 185), income,
  past dates, edit, delete + undo, ⋮ units, custom range, wallet switcher, the empty picker of a
  wallet hiding all income, wallet / category locks, the book delete count; `setOffline` and
  the API really stopped (syncs by itself when back); an untrusted device offline can't save;
  two trusted devices (the later edit wins, the loser's notice); A deletes an empty wallet
  offline while B adds to it → B's row goes too; 20,000 rows (pull ≈ 5.5 s, month ≈ 0.17 s,
  "ทั้งหมด" ≈ 0.8 s after the 100-row pages; it froze for 12 s before). Tests: API 512, web 425.

## Done: Category 7.2 (#7)

- **Decided at the start of 7.2** (owner, category.md rule 13): hiding a parent stores the
  parent's id only (children follow, also later ones; their switches show off and locked), an
  archived category's id stays, ids of known tombstones and duplicates are dropped on save, a
  wallet may hide every category of a type, and the row is in the wallet form when creating and
  editing. The book delete confirm counts categories too (rule 12, owner's request).
- **Decided while building** (owner, from HTML mock-ups): no explanation line in the categories
  view; the form rows look like "หมวดหมู่หลัก" (label left, value right, ›); **the category form
  also chooses its wallets** ("ใช้ในกระเป๋า", owner's idea: a new category used only on a credit
  card in one go), written to those wallets' `hiddenCategoryIds` in the same local write
  (later-edit-wins per wallet row as usual). The buffet icon is redrawn as a chafing dish
  (`tpnBuffet`, pick A); the first drawing stays as `tpnServingDomes`, and `tpnBuffetLine` and
  `tpnAllYouCanEat` joined the food group ("keep them all").
- **API**: migration `0011_wallet_hidden_categories` (`wallets.hidden_category_ids`, JSON text,
  default `'[]'`), the wallet schema checks the shape only (UUIDs, at most 200; absent = `[]`),
  the handler writes / pulls the array, OpenAPI `SyncWalletRow.hiddenCategoryIds`.
- **Web**: local schema step 7 + `SYNC_TABLES.wallets.json` (JSON columns: `putRow` writes
  `[]` when absent, `fromSql` parses); `core/wallet/hidden-categories.ts` (`isHiddenIn`,
  `cleanHidden`, `toWallet`, `findWallet`); `WalletService.openOf(bookId)`;
  `CategoryService.treeOf()`, `hiddenIn()`, `save(..., hiddenIn)`; the shared
  `app-toggle-list-field`; wallet sheet view `categories`, category sheet view `wallets`;
  `BookService.categoryCount()`.
- **Checked**: curl (no field → `[]`, two ids, 200 ok, 201 / not a UUID / not an array / null
  refused, pull, two devices from one `baseSeq`: the later edit wins and the loser's array is
  in `change_history`). Playwright at 375×812 in th/en × light/dark on `npm run build`: hide a
  parent (children locked, "ซ่อน 7" counts them), the income tab, save and reopen, the category
  form's "ใช้ในกระเป๋า" (a wallet hiding the parent is locked), the book delete confirm
  ("กระเป๋าเงิน 2 ใบ หมวดหมู่ 27 รายการ"), the icon picker. Two devices: A offline edits first,
  B online later → B wins and A shows B's list; B first, A offline later → A wins the whole row.
  Server really stopped: a new category used only in one wallet queues 2 ops and syncs once the
  server is back. An untrusted device offline can't save. Tests: API 497, web 381.
- **Known** (fixed right after, see below): with the network up but the API down, the app
  retried only on a write, a visibility change, "sync ตอนนี้" or the 5-minute timer.

## Done: Server unreachable (after 7.2)

- **Decided** (owner, after 7.2; offline-sync rules 1 and 11): with the network up but the API
  not answering (or a proxy answering 502–504), the device marks the server unreachable and
  retries by itself after 5 s, 15 s, 30 s, 1 min and 2 min, then every 5 min, until a round gets
  through; the pill says "เซิร์ฟเวอร์ไม่ตอบ" (red) and the sync sheet says it retries by itself; an
  untrusted device can't write meanwhile (its rows would only live in memory), and its notices
  say the server is down rather than "go online".
- **Web**: `NetworkStatusService.serverReachable`, `SyncService` retries (`RETRY_DELAYS_MS`,
  also for a session check that couldn't reach the API when the app opened),
  `SyncStatus` `'unreachable'`, `BookService.canWrite` / `serverDown`.
- **Checked** (Playwright on `npm run build`, th and en, the API process really stopped): a
  trusted device writing while down shows "เซิร์ฟเวอร์ไม่ตอบ · รอ 1" within a second and syncs by
  itself 14–27 s after the API is back; a device opened (PIN) while down gets its session back and
  syncs by itself; an untrusted device blocks saving with the server-down notice and allows it
  again by itself. Tests: web 385.

## Done: Category 7.1 (#7)

- **Decided at the start of #7** (owner, category.md → Open questions): split 7.1 / 7.2; the
  default set follows the app's language when the book is created; the manage screen is
  Account › หมวดหมู่ with the current book on top (tap to switch); hiding per wallet is a
  `wallets` column; a refused book create groups its refused child rows (categories, first
  wallet) under one sync-sheet item, fixed or discarded together. Proposed in the revision and
  kept: archived categories hold no name, at most 200 open per book, a pulled parent
  tombstone takes its children, unarchiving a parent brings its children back.
- **Decided while building** (owner, from HTML mock-ups): **white glyphs on every user colour**:
  five palette colours went one step darker so white reaches 4.5:1 on all ten (`userColor` draws
  a row's old colour as its new one; DESIGN.md §3). The **Account tab is grouped rows that open
  pages** (option A1: ข้อมูลของฉัน — สมุด, หมวดหมู่; บัญชีและความปลอดภัย — ความปลอดภัย;
  การตั้งค่า — การแสดงผล, เครื่องนี้), and a page inside it has a ‹ in the header. The buffet
  icon doesn't read well yet; the owner is fine to redraw icons later.
- **API**: `categories` (migration `0010_categories`; `bookId` and self `parentId` FKs with
  cascade), `features/category` (pushable handler; `check`: the user's live book and no move,
  a live top-level parent of the same book and type, open for an open child, a parent with
  live children stays top-level and keeps its type, a unique name among open siblings, 200
  open), OpenAPI `SyncCategoryRow`, `scripts/seed-default-categories.ts` (one-off, Thai, removed in 2026-11, for
  books with no category rows).
- **Web**: local schema step 6 (`categories`) + `SYNC_TABLES`, joined `BOOK_CHILD_TABLES`;
  `core/category` (`CategoryService`); `BookService.save` writes the default set
  (`core/book/default-categories.ts`) with a new book, `rejectedItems()` /
  `discardRefused()` and the fix re-sending refused child rows, `switchSheet` (the switch sheet
  moved to the shell); `outbox.moveOpLast` (a category put under a parent made after it is pushed
  after it); `sheets/category-sheet` + `app-segmented-field`; `features/account` pages
  categories / appearance / device and the grouped account page; the header's ‹
  (`parentOf`); 7 new `tpn` icons and `CATEGORY_ICON_GROUPS` (8 groups). The initial bundle
  warning budget went 640 → 680 kB (the header's icon badge now carries the category icons;
  662 kB).
- **Checked**: curl (create, every parent rule, sibling clash in any case, other type / parent /
  book free, archived name free and its unarchive refused, archive with children, child of
  an archived parent refused, the 201st open, another user's book and id, a move between
  books, a deleted book or parent, pull scoping, the one-off script twice, `sync:cleanup`
  cascade). Playwright at 375×812 in th/en × light/dark on `npm run build`: the default set,
  tabs, add a sub-category through the icon and parent views, name clash, discard, a parent
  with children (type and delete locked), archive + undo, the archived fold, a child refused
  while its parent is archived, unarchive brings children back, delete confirm, order mode by
  mouse drag (parents and children), arrow keys and touch long-press (a quick swipe does
  nothing); device B (untrusted) sees A's set; A offline adds a category and a book whose
  names B takes first → back online, two items in the sync sheet (the book "with 27
  categories"), both fixed → synced, B sees the fixed book with its 27; deleting a book
  tombstones its 29 categories on the server; a **really offline** reopen (both servers
  stopped) adds a category that syncs once back; untrusted offline blocks adding. Found and
  fixed while checking: fixing a refused book left its children rejected, and the pill
  counted them one by one. Tests: API 491, web 366.
- **Known**: the book delete confirm counted wallets only (fixed in 7.2). Same local-proxy limits as before (20 sign-in mails per hour, the 60 s cooldown
  per email).

## Done: Book + Wallet (#6)

Specs: [book.md](docs/features/book.md), [wallet.md](docs/features/wallet.md). **Decided at
the start of #6**: two parts, one session and PR each, because wallets, categories and
transactions all carry a `bookId`, so `books` must exist first.

| Part | What                                                                                                               | Status |
| ---- | ------------------------------------------------------------------------------------------------------------------ | ------ |
| 6.1  | `books` (API table + sync handler; device table), create step, book form, header switcher, Account › สมุด | ✅     |
| 6.2  | `wallets` + `wallet_members`, Wallets tab, wallet form + icons, first-wallet step, **remove `sync_probes`**        | ✅     |

Decided with the owner (don't re-ask):

- **Books are made by the user.** No automatic book or wallet (replaces wallet rule 7).
  Onboarding = create a book → its first wallet. The app reopens on the device's last
  book (`tpn-book:<userId>`, book rule 6).
- **Book look** (6.1): a lucide icon from a curated set on a user colour. The switcher
  replaces the page title on the Transactions, Wallets and Reports tabs. Delete asks in a sheet
  (no undo, takes the book's wallets and transactions with it from 6.2); the last book may
  be deleted.
- **Categories**: one set per book, and a wallet can hide categories it doesn't use. The
  default set (category rule 8) comes with #7, written by the device that creates the book
  in the same local write; 6.1 writes no categories.
- **For 6.2** (wallet.md revised before it): wallets have **no type** (drop `type`); icons are
  lucide **plus our own `tpn` SVGs** in lucide's style where lucide lacks a clear picture, chosen
  to say what the thing is (several bank and card drawings instead of bank logos; **no letter
  badges**, dropped before 6.2), so DESIGN.md §7's "lucide only" changes with it; a new wallet
  gets a default icon the user can change; names are unique within the book; archive is
  built in 6.2; the currency can change only while the wallet has no transactions, and the form
  says why when it can't.
- **For #8** (owner's direction): the Transactions tab's wallet switcher sits at the header
  centre and a ⋮ menu at the right holds the time range (day / month by default / quarter / year
  / all / custom); layout confirmed with a mock-up at #8's start (transaction.md → Open
  questions).
- 6.1 leaves out: `wallets` / `wallet_members`, the Wallets tab, the `tpn` icon set and removing
  `sync_probes` (all 6.2).

6.2 in detail (✅ done, API + web):

- **Decided at its start** (owner, wallet.md → Open questions): at most **20 open wallets per
  book** (archiving frees a place); a **+/− button** for a negative starting balance (phone
  keypads have no minus); a device that pulls a book's tombstone **tombstones that book's
  wallets it holds** (a wallet another device synced survives a delete made where it wasn't
  known). The revised spec had been pushed after 6.1's PR merged, so 6.2 cherry-picked it.
- **Decided while building** (owner, from HTML mock-ups): **every sheet is 92dvh** with a header
  bar (X / ‹ left, title centred, icon actions right) and **one main button pinned at the
  bottom** (no "ปิด"); the wallet and book forms are **compact** (icon + name on one row, the
  icon opening an "ไอคอนและสี" view, no labels or hints); archive and delete are header icons,
  delete and discard are confirm views, **archiving offers undo** in its toast; the Wallets
  tab's total sits 12px above the list. The currency stays per wallet (locked decision): the form
  shows "THB" and becomes a picker only when a second currency is active. DESIGN.md §6–8 hold the
  rules.
- **API**: `wallets` + empty `wallet_members` (migration `0007_wallets`; `bookId` FK with
  cascade, so purging a book's old tombstone takes its wallets'), `features/wallet` (pushable
  handler; `check`: the user's live book, no move between books, an active currency for a
  new or changed one, a unique name among the book's open wallets, 20 open), OpenAPI
  `SyncWalletRow`. `sync_probes` removed: feature, schema, `0008` drops the table, custom `0009`
  deletes its `change_history` rows.
- **Web**: local schema step 4 (`wallets`) and step 5 (drop `sync_probes` with its ops and
  notices); `core/wallet` (`WalletService`); `features/wallets` (Wallets tab: totals per
  currency, list, order mode, folded "เก็บถาวร"); `sheets/wallet-sheet` + `wallet-first-step`
  (the shell's gate on the Transactions and Wallets tabs, ➕ follows); `BookService` deletes a
  book's wallets in the same write, counts them for the confirm and sweeps orphans
  (`BOOK_CHILD_TABLES`); `shared/components/sheet` (`app-sheet-frame`, now under all four
  sheets), `app-name-icon-field`, `app-amount-field`, the grouped `app-icon-field`, the first
  `tpn` SVG set + `WALLET_ICON_GROUPS`, `shared/utils/money`. Account › Sync test is gone. The
  initial bundle warning budget went 620 → 640 kB (the header's icon badge carries every user
  icon; now 623 kB).
- **Checked**: curl (create, every validation, `ID_TAKEN`, another user's book, a deleted
  book, a move, inactive / unknown currency, a case-insensitive name clash, an archived
  duplicate allowed and its unarchive refused, the 21st wallet, `overridden`, pull scoping,
  `sync:cleanup` cascade; after removal `tables` has no probe and a probe push is
  `UNKNOWN_TABLE`). Playwright at 375×812 in th/en × light/dark on `npm run build`: create step
  → book → first-wallet step → wallets (negative, excluded, archived, every `tpn` icon), totals,
  order mode by mouse drag, touch long-press (a quick swipe does nothing) and arrow keys, kept
  after reload; device B (untrusted) sees A's wallets; A offline adds a name B adds online first
  → rejected → fix from the sync sheet → synced on both; deleting a book with wallets (the
  confirm counts them; B's wallet A never saw is swept); untrusted offline blocks writing; a
  **really offline** reopen (both servers stopped) adds a wallet that syncs once back; archive +
  undo, unarchive refused, delete and discard confirms, the icon view. Tests: API 468, web 320.
- **Known**: archived wallets' fold state isn't kept across visits. When the API is down but the
  browser stays online, the session is re-checked only on an `online` event or an unlock, so a
  queued op waits for one of those (from 4a; noticed here). The ±10¹⁵ balance check counts the
  digits typed, so a starting balance never loses precision but a 17-digit paste is refused as a
  format error. Same local-proxy limits as before (20 sign-in mails per hour, the 60 s cooldown
  per email).

6.1 in detail (✅ done, API + web):

- **Decided at its start** (owner): split #6 into 6.1 / 6.2; the category default set waits for
  #7 (written with the book on the device); book look = curated lucide icon on a user
  colour; the switcher replaces the page title on the three data tabs; delete asks in a sheet and
  the last book may go. **While building**: up to 20 books and a name unique among live
  ones (both server checks, `CONFLICT`); the current book lives in `localStorage` on a trusted
  device and `sessionStorage` on an untrusted one, and a wipe forgets it; reorder = an order mode
  with **one grip handle per row** (press and hold ~0.3 s on touch, ↑ / ↓ for keyboards; owner's
  choice over up / down buttons); a fixed refused create becomes current again; closing a sheet
  never asks, even with unsaved input (it once asked "ทิ้งที่แก้ไว้ใช่ไหม"; dropped by the owner
  in 2026-11 as more annoying than useful); the **tab bar shows the active tab by
  colour alone** (no pill; owner picked option B of four mock-ups).
- **API**: `books` (migration `0006_profiles`), `features/book` registers a pushable sync
  handler (validate / find / check / write / purge, like `sync-probe`), no REST routes; OpenAPI
  `SyncBookRow`.
- **Web**: local schema step 3 (`books`) + `SYNC_TABLES`; `core/book` (`BookService`:
  list, `current()`, `ready()`, `canWrite()`, `save` / `remove` / `moveTo`, sheet state,
  `openFix`); `layout/` gained the header switcher + switch sheet, the book sheet (deferred),
  the create step the shell shows on the data tabs while there is no book (a spinner until a
  new device's first pull) and the ➕ redirect; `features/account/pages/books-page`;
  `shared/components/icon-badge` (`app-icon-badge`, `BOOK_ICONS`, `USER_COLORS`,
  `glyphColor`) and the shared `app-icon-field` / `app-color-field`. The initial bundle warning
  budget went 600 → 620 kB (the header needs the book icon set at start).
- **Checked**: curl (create, case-insensitive name clash, every validation, another user's id,
  the 21st book, delete then reuse the name, an older edit `overridden`, pull scoping,
  `sync:cleanup`). Playwright at 375×812 in th/en × light/dark on `npm run build`: create step →
  sheet (errors, icon, colour) → no-wallet step; device B (untrusted) sees A's book; A adds
  from the switcher and it becomes current; reopen (PIN) lands on the last book, also after
  switching; B keeps its own current book; A offline adds a name B adds online first →
  rejected → fix from the sync sheet → renamed and synced; order mode by mouse drag, touch
  long-press (a quick swipe does nothing) and arrow keys, kept after sync and reload; delete
  with confirm, B told "ถูกลบจากเครื่องอื่น"; delete all → create step, ➕ follows; a **really
  offline** reopen (both servers stopped) keeps the last book and queues an add that syncs
  once back; untrusted offline blocks editing. Tests: API 454, web 279.
- **Known**: a mouse "swipe" on the sheet in headless Chromium doesn't close it, so the swipe
  path was only checked through Escape / backdrop (same handler); try it on a phone. Through one
  local proxy every browser shares the 20 sign-in mails per hour (empty `rate_limit_buckets` as
  before). The sign-in mail's 60 s cooldown applies to the second device of the same email.

## Done: Offline sync foundation (#4a)

Spec: [docs/features/offline-sync.md](docs/features/offline-sync.md). **Decided at the start of
#4a**: two parts, one PR each; local DB = SQLite WASM in memory + one encrypted snapshot in
IndexedDB (spike numbers in the spec's Open questions); one tab at a time; an expired session keeps
the app usable on local data with a "sign in again to sync" banner.

| Part | What                                                                                          | Status |
| ---- | --------------------------------------------------------------------------------------------- | ------ |
| 4a.1 | Trust step, encrypted local DB, PIN lock (keypad), auto-lock, wipe rules, Security › device   | ✅     |
| 4a.2 | Sync tables, `/sync/push` + `/sync/pull`, outbox, sync status, rejected ops, conflict notices | ✅     |

The dev-only probe below was removed in 6.2 (feature folder, handler, web page, local table, and
migrations dropping `sync_probes` and its history).

4a.2 in detail (✅ done, API + web):

- **Decided at its start**: Currency (#5) folded in as pull-only master data (rows from a
  migration, since production needs them); push proven by a temporary **dev-only**
  `sync_probes` table with a test page (Account › Sync test, shown while the server lists the
  table), not a test-only table, so outbox, offline, two devices, conflicts and rejections can be
  tried in the real app; the sync status is **one header pill** that replaces the online/offline
  pill.
- **API**: `core/sync` registry (per-table handler: `pull`, and for pushable tables `validate`,
  `find`, `check`, `write`, `purge`), `features/sync` (`/sync/push`, `/sync/pull`, conflict rules
  in the service, `sync_state` counter, `sync_ops`, `change_history`, `npm run sync:cleanup`),
  `features/currency` (`GET /currencies`, pull-only handler), `features/sync-probe` (dev only).
  `GoneError` (410) joined the domain errors. Migrations `0004_offline_sync`, `0005_currency_seed`.
- **Web**: local schema step 2 (`currencies`, `sync_probes`, `outbox`, `sync_notices`);
  `outbox.ts` (one pending op per row), `sync-tables.ts` (camelCase ↔ snake_case),
  `SyncService` (rounds under the `tpn-sync` Web Lock on open / online / foreground / 2 s after
  a write / every 5 min), `OfflineService.openUntrusted()` (untrusted devices sync an in-memory
  copy, online only), `changes` / `isOpen` signals; `layout/sync-status` (pill) +
  `sheets/sync-sheet` (spartan drawer, loaded on first open); sign-out pushes first and asks
  before losing ops. The initial bundle warning budget went 550 → 600 kB: the drawer's CDK
  overlay lands in the main bundle even though the sheet is deferred (every later bottom sheet
  needs it anyway).
- **Decided while building**: a quiet device's pull cursor jumps to the server's latest
  `changeSeq` (read before the rows), else it falls below the purge watermark and gets `410` on
  every round; a newer write replaces an in-flight op with a new `opId`, and the old op's answer
  moves the newer op's `baseSeq`; a `rejected` op restores the server's row locally and keeps the
  refused values for "fix"; the sheet shows the translated reason by `code`, never the server's
  English message; devices pull every currency (inactive too) and filter themselves.
- **Checked**: curl (applied, retried `opId`, clamped future times, overridden / later edit wins
  / tie, delete beats edit, undo, every rejection code, another user's row and `opId`, paging,
  per-device notices, `sync:cleanup` then `410`). Playwright at 375×812 in th/en × light/dark on
  `npm run build`: add → "รอ sync 1" → "sync แล้ว"; two devices of one user (A offline edits and
  adds; B edits the same row later and adds the same title; A back online → overridden with a
  notice + a rejected op; fix from the sheet; a later edit wins and the losing device gets the
  notice on pull; delete + undo synced); sign-out with a rejected op asks first; an untrusted
  device syncs online and can't write offline; a **really offline** reopen of a trusted device
  (web server stopped) adds a pending row that syncs once back. Tests: API 437, web 242 (specs
  run the real SQLite build from `node_modules`).
- **Known**: the probe page and table were temporary (removed in 6.2). Sharing rules 13–16 (owner
  wins, editor offline adds) arrive with #16. `change_history` isn't purged yet. The sync pill
  doesn't say "sign in again" itself; the expired-session banner does.

4a.1 in detail (✅ done, web only):

- **API**: no change. `/auth/refresh` already tells `SESSION_REVOKED` (and `USER_DISABLED`) from
  `SESSION_EXPIRED`, which decides wipe vs keep (spec rule 7).
- **Web**: `core/offline`: `LocalDatabase` (SQLite WASM in memory, schema steps by
  `PRAGMA user_version`; 4a.1 only has `sync_meta`), `vault-crypto` (AES-GCM data key, AES-KW wrap
  by a PBKDF2-SHA256 600k PIN key), `vault-storage` (IndexedDB `tpn-vault`: clear meta +
  one sealed snapshot), `OfflineService` (trust, unlock, lock, change PIN, wipe, coalesced saves,
  auto-lock after 5 min idle or in the background, one tab via the `tpn-local-db` Web Lock +
  BroadcastChannel takeover, wipe on `revoked`). `shellGuard` replaces `authGuard` on the shell;
  `trustGuard`, `lockGuard`, `otherTabGuard` guard `/auth/trust`, `/auth/lock`, `/auth/tab`.
  `AuthStore` gained `endedBy`, `freshSignIn`, `keepsLocalSession`; `AuthService` gained
  `finishGoogleSignIn()` and `signOutOrLater()` (a sign-out made offline is kept in
  `tpn-sign-out-pending` and sent at the next start before any refresh). Shared `app-pin-pad` /
  `app-pin-setup`; `/account/pin` (turn on / change PIN); the Security page's "This device" group;
  the expired-session banner under the header. The wasm is copied to `/sqlite/` and prefetched by
  the service worker; the initial bundle warning budget is 550 kB.
- **Decided while building**: the current PIN is checked as soon as it's typed on the change-PIN
  page (a wrong one counts toward the 5); 5 wrong PINs also sign the device out (now or, offline,
  at the next start), so a wiped device can't walk back in online; the lock screen's "forgot
  PIN" signs out and wipes after asking.
- **Checked**: curl for the refresh codes the wipe rules read (revoked after sign-out, expired with
  no cookie, sign-out without a cookie answers `200`). Playwright at 375×812 in th/en ×
  light/dark on `npm run build` (service worker on): trust step (installed / tab defaults, iOS
  note), PIN set + mismatch, lock + warning from the 3rd wrong PIN, a **really offline** reopen
  (web and API stopped: the SW serves the shell and the wasm, PIN unlocks, lazy tabs open), the
  5th wrong PIN offline (wiped, sign-out sent once back online, the old cookie then
  `SESSION_REVOKED`), expired session → banner → same user signs in with data kept, another user
  → wipe → their trust step, revoked elsewhere → wipe, second tab → "use here" hand-over,
  auto-lock at 5 min idle (clock fast-forwarded), change PIN, turn offline off. Tests: web 194
  (vault crypto, `OfflineService` on an in-memory vault and fake database, guards, auth store /
  service / interceptor changes, PIN pad / setup, lock / trust / PIN pages, banner, Security
  page group); API unchanged (374).
- **Known**: Playwright's `setOffline` doesn't cut the service worker's network, so offline checks
  stop the servers instead. Each tab holds its own unlocked copy, so taking over in another tab
  asks for the PIN again. (Untrusted devices open the in-memory database since 4a.2.) Someone with DevTools on an unlocked browser book can still use the
  refresh cookie online; the PIN protects the local data, not the session (spec rule 4's honest
  limit). Each unlock costs ~0.3 s of PBKDF2 on a laptop, more on an old phone.

## Done: Auth (#4)

Spec: [docs/features/auth.md](docs/features/auth.md). Built in five parts (4.4 was split in two at
its start), one PR each, API and web together. The endpoints table in the spec says which part each
route belongs to.

| Part | What                                                                                     | Status                                  |
| ---- | ---------------------------------------------------------------------------------------- | --------------------------------------- |
| 4.1  | Email code + magic link, open sign-up, sessions (refresh rotation), sign-out, `/auth/me` | ✅                                      |
| 4.2  | Optional password (Argon2id, breach check), recent-auth rule + step-up code              | ✅                                      |
| 4.3  | Google sign-in (OIDC + PKCE)                                                             | ✅                                      |
| 4.4a | Account → Security: sessions, sign out others, link / unlink Google, credential mail     | ✅                                      |
| 4.4b | Phone OTP: add / change / remove a number, sign in with phone (console SMS provider)     | ✅ (hidden in the web: `PHONE_FEATURE`) |

4.1 in detail (✅ done):

- **API**: tables `users`, `otp_challenges`, `sessions` (with `authTime`), `rate_limit_buckets`
  (`user_identities` comes with 4.3, `password_credentials` with 4.2). Endpoints
  `POST /auth/email/start`, `POST /auth/email/verify`, `POST /auth/refresh`, `POST /auth/sign-out`,
  `GET /auth/me`. `authenticate` middleware, `trust proxy`, `__Host-rt` cookie, Origin check,
  DB-backed limits, mail through `notifier` in the UI language. New env: `JWT_SECRET`,
  `OTP_PEPPER` (random values from `setup-env`), `WEB_ORIGIN`, `TRUST_PROXY_HOPS`,
  `SIGNUP_ENABLED`, `EMAIL_DAILY_LIMIT`. Cleanup (rule 20) as the npm script `auth:cleanup`; its
  cron endpoint waits for #17.
- **Web**: sign-in, enter-code (`app-otp-field`) and magic-link (`/auth/link`) pages outside the
  shell; auth store (access token in memory), API client + interceptor (refresh once on 401, then
  sign-in), auth guard, silent refresh at start, sign-out on the account page.
- **Checks**: curl in the sandbox (start → code from stdout → verify → refresh → sign-out, plus
  wrong, expired, reused codes and limits), Playwright at 375×812 (light/dark, th/en), then tests +
  OpenAPI once the owner confirms the behaviour.
- **Not in 4.1**: password, Google, phone, trusted device / PIN / local DB (#4a), invitations (#16).
- **Checked**: curl against the dev API (mail read from stdout) for the happy path and every
  error path, limit and the closed-sign-up / daily-cap configs; Playwright at 375×812 in th/en ×
  light/dark for code and link sign-in, reload (silent refresh), sign-out, three tabs refreshing
  at once, and the interceptor's refresh-and-retry. Tests: API 147 (service on an in-memory repo,
  HTTP, Drizzle adapter on SQLite, core security/errors), web 40 (auth service, interceptor,
  guards, error messages).
- **Known**: through `ng serve`'s proxy every browser is `127.0.0.1`, so the per-IP limit (20
  starts/hour) is shared by everything you test locally; empty `rate_limit_buckets` in
  `api/data/local.db` if you hit it. Opening the built app offline with a session (start-up
  refresh unreachable) was only checked in `ng serve`, where there's no service worker.

4.2 in detail (✅ done):

- **Decided at the start of 4.2**: password = 8–128 characters with lower + upper + digit + other
  (owner's choice over NIST's 15+, spec rule 11), plus the HIBP breach check
  (`PASSWORD_BREACH_CHECK=hibp|off`, `HIBP_API_URL` for a local stand-in; fail open after 3 s) and
  "not the email". Recent auth = `authTime` ≤ 10 min, the current password, or a **step-up code**
  (`/auth/reauth/start` + `/verify`, code-only mail, updates `authTime` of the current family).
  The password screen is `/account/password`, opened from a short "Security" section on the
  account page until 4.4.
- **API**: table `password_credentials` (Argon2id PHC string via `@node-rs/argon2`, m = 19 MiB,
  t = 2, p = 1, rehash on sign-in when the parameters change), `otp_challenges.purpose` gains
  `reauth`. Endpoints `POST /auth/password/sign-in`, `PUT` / `DELETE /auth/password`,
  `POST /auth/reauth/start` / `verify`; `hasPassword` on every `user`. Failure limits 5 per email
  and 30 per IP per 15 min; `PUT` revokes every other session family.
- **Web**: "Sign in with password" link + `/auth/password` page; account → Security row →
  `/account/password` (set / change / remove, re-auth step in place).
- **Not in 4.2**: Google, phone, sessions list / sign out others (4.4), mail on password change
  (backlog), trusted device / PIN (#4a).
- **Form rules that came out of the review** (web/DESIGN.md §6): one error message at a time (a
  server error clears once the user edits the form), field hints and errors 4px under the input,
  server error lines 8px under the field.
- **Checked**: curl against the dev API with a local HIBP stand-in (every policy code, set →
  other device `SESSION_REVOKED` → password sign-in, recent auth by time / current password /
  step-up code, wrong / reused / other user's codes, same answer and timing for wrong password,
  unknown email and no password, both failure limits with `Retry-After`, disabled user, rehash,
  HIBP slow / down / `off`, no password in any log); Playwright at 375×812 in th/en × light/dark
  for the whole flow. Tests: API 218 (service, HTTP, Drizzle adapter, Argon2 helpers, HIBP
  checker against a local server), web 67 (auth service, policy validator, error keys, the
  password page's confirm step).
- **Known**: the step-up mail shares the sign-in mail's 60 s cooldown (spec rule 13), which only
  shows when a test ages a session by hand. The policy is checked in the browser too, so a change
  to `PASSWORD_POLICY` goes in both `api/…/auth.const.ts` and `web/…/core/auth/password-policy.ts`.

4.3 in detail (✅ done):

- **Decided at the start of 4.3** (spec rule 14): tested in the sandbox against a **local OIDC
  stand-in** (`npm run dev:oidc` in `api/`, its issuer set by `GOOGLE_ISSUER`); an existing user
  with the same verified email is **linked automatically** and the web shows a one-time notice;
  Google's name and picture are used **only when the user is created** (linking only fills an
  empty avatar); callback errors show on the web's `/auth/callback` page (`?error=<reason>`);
  the button sits under the email form after an "or" divider; the account page gets a read-only
  "Google · linked" row; the web asks `GET /auth/providers` whether Google is on.
- **API**: table `user_identities`; `GET /auth/providers`, `GET /auth/google/start`,
  `GET /auth/google/callback`; `identities` on every `user`. New env: `GOOGLE_CLIENT_ID`,
  `GOOGLE_CLIENT_SECRET`, `GOOGLE_ISSUER`. `core/security` gained an OIDC client
  (`oidc-client.ts`: discovery, code exchange, ID token check) and a sealed JWE box
  (`sealed-box.ts`) for the `__Host-goidc` round-trip cookie.
- **Web**: "Continue with Google" on sign-in, `/auth/callback`, the account page row. spartan
  `sonner` was added; the toaster lives in the app root, lifted above the tab bar.
- **Checked**: curl against the dev API and `dev:oidc` for new user, second sign-in, linking (name
  kept, empty avatar filled, `linked=google` once), `/auth/me`, every broken token (aud, issuer,
  expiry, signature, nonce), state mismatch, missing cookie, code replay, provider down, unverified
  email, cancel, sign-up closed (strangers refused, existing users and linking still work),
  disabled user, the per-IP limit, unsafe `returnUrl`s and no env (`404`). Playwright at 375×812
  in th/en × light/dark for the button, the round trip to `returnUrl`, the account row, the link
  toast, the error pages, cancel, Google off and offline. Tests: API 286 (service on a fake
  provider, HTTP, OIDC client against a local provider with real RS256 keys, sealed box, env,
  Drizzle adapter), web 85 (providers + start URL, callback page, sign-in button).
- **Known**: one Google round trip per browser at a time: starting a second one in another tab
  replaces the `__Host-goidc` cookie, so finishing the first ends in `error=failed`. The button
  is our outline style with Google's real "G" mark, not Google's white / dark button. A real
  Google client (Cloud Console, redirect URI `<WEB_ORIGIN>/api/auth/google/callback`) is set up
  at deploy (#17); until then only the stand-in has been used.
- **Not in 4.3**: linking Google while signed in, unlinking (4.4), mail on linking (backlog "Mail
  on credential change").

4.4 (decided at its start, spec rules 21–31; 4.4a and 4.4b ✅ done):

- **Split**: 4.4a (Security page, sessions, Google link / unlink, mail on credential change) and
  4.4b (phone OTP) are separate sessions and PRs, 4.4a first.
- **Security page** `/account/security`: one "Security" row on the account page opens it; two
  groups, "Ways to sign in" (password → `/account/password`, phone → `/account/phone` in 4.4b,
  Google with Link / Unlink in the row) and "Signed-in devices" (sessions + "Sign out other
  devices"). The confirm step (`reauth-step`) runs in place.
- **Sessions** (rule 28): device from the user agent (parsed on the web), signed in at, last
  active, "This device"; revoking one or all others needs **no** recent auth. `sessions` gains
  `signedInAt` (copied on rotation), since the family's first row is deleted by cleanup.
- **Google link** (rule 29): `POST /auth/google/link` needs recent auth and returns the Google
  URL (the round-trip cookie carries `mode: link`); one Google per user; a Google account linked
  to someone else is refused (`google_in_use`), never merged; its email need not match. Back on
  `/account/security`. **Unlink** (rule 30) needs recent auth.
- **Mail on credential change** (rule 31): password set / changed / removed, Google linked
  (including automatic linking) / unlinked, phone added / changed / removed; no link, no code;
  language from `lang` in the request; never blocks the change.
- **Phone (4.4b)**: `GET /auth/providers` gains `phone` (`SMS_PROVIDER` ≠ `disabled`), and
  `/auth/phone*` answer `503` before any lookup when it's off; one Thai-style `tel` field shown as
  `081-234-5678`; Thai SMS of one segment (≤ 70 UTF-16 units, rule 26).
- **API (4.4a)**: `sessions.signedInAt` (migration 0003, hand-edited: SQLite can't add a NOT NULL
  column to a table with rows; old rows get it from the absolute expiry). `GET` / `DELETE
/auth/sessions`, `DELETE /auth/sessions/:id`, `POST` / `DELETE /auth/google/link`. The Google
  round-trip cookie may now carry `link: { userId, sessionFamilyId }` and `lang`; the callback asks
  `googleFlowMode()` which way to go. Credential changes take `lang`; `notifyCredentialChange`
  sends the mail of rule 31. New error codes `CURRENT_SESSION`, `IDENTITY_ALREADY_LINKED`,
  `GOOGLE_IN_USE`.
- **Web (4.4a)**: `/account/security` (`features/account/pages/security-page`), the account
  page's single Security row, `deviceLabel()` (user agent → "Chrome · Android"), and `ReauthFlow`
  (`features/account/reauth-flow.ts`): the confirm-step state, provided per page and shared by the
  password and Security pages.
- **Checked (4.4a)**: curl against the dev API and `dev:oidc` for the session list (order, current,
  `signedInAt` kept on refresh), revoke one / own (`400`) / unknown / someone else's (`404`), sign
  out others and the revoked devices' `SESSION_REVOKED`; Google link with recent auth by step-up
  code and by password, `IDENTITY_ALREADY_LINKED`, `google_in_use`, cancel, bad signature and
  nonce, session revoked or user disabled during the round trip, the per-IP limit; unlink and its
  no-op; mails in th / en (also for an automatic link), the daily cap skipping the mail but not the
  change; migration 0003 on a table with rows. Playwright at 375×812 in th/en × light/dark for the
  page, the revoke confirm, the link round trip + toast, unlink by password and by email code, the
  in-use error, sign out others and offline. Tests: API 323 (service, HTTP, Drizzle adapter, mail
  builder), web 104 (auth service, device label, Security page).
- **Known (4.4a)**: a current-password proof covers one request only (as in 4.2): linking right
  after unlinking with a password asks again; a step-up code covers 10 minutes. The device name is
  a hint from the user agent: an iPad on Safari says "Safari · Mac", and a PWA looks like its
  browser. "Last active" moves on sign-in and refresh, not on every API call. A signed-out
  device's access token still works for its last ≤ 10 minutes (rule 28). A long "last active"
  wraps the device row to three lines at 375px; the owner accepted that.
- **Not in 4.4a**: phone OTP (4.4b, rules 21–27: the `console` SMS provider, `/auth/phone*`,
  `providers.phone`, `/account/phone`, `/auth/phone`), the ThaiBulkSMS adapter (backlog), trusted
  device / PIN / local DB (#4a), invitations (#16).

4.4b in detail (✅ done):

- **Decided at the start of 4.4b** (spec rules 21–27, 31): the mail on a phone change names the
  last 4 digits; `/account/phone` stays put after a confirm (a "saved" line, like the password
  page); the saved number typed again is refused before any SMS (`422 PHONE_UNCHANGED`); the
  sign-in page's "Sign in with phone number" sits at the bottom under "Sign in with password".
  Also settled: the daily SMS cap is checked on every start but counted per SMS sent, sign-in and
  add-number starts share the per-number / per-IP buckets, the `503` carries `PHONE_DISABLED`,
  `POST /auth/phone/confirm` needs no recent auth (the code was sent after it).
- **API**: `POST /auth/phone/start` + `/verify` (5-min SMS code, `202` and the minimum time for
  any number, nothing stored for an unknown one), `POST /auth/phone` (recent auth) +
  `/confirm` (`409 PHONE_IN_USE`, the code used up), `DELETE /auth/phone`; `phone` on every
  `user`, `providers.phone`. A `phoneGate` answers `503` in front of every `/auth/phone*` while
  `SMS_PROVIDER=disabled`. `otp_challenges` rows now carry their `channel` (the repository's
  challenge methods take an optional channel, plus `*UserChallenge` methods for
  `verify_phone`); no migration (the columns existed since 4.1). New env `SMS_DAILY_LIMIT`
  (default 100). `normalizeThaiMobile` / `maskPhone` in `shared/utils/phone.ts`; numbers are
  masked in logs and `phone` is redacted from error logs. SMS texts in `auth.mail.ts`
  (`buildPhoneSms`, 63 UTF-16 units).
- **Web**: `/auth/phone` (`PhoneSignInPage`) → the shared `/auth/code` screen in SMS mode
  (`AuthFlowStore.pending().phone`); `/account/phone` (`PhonePage`: number → SMS code with a
  resend timer, remove after asking, confirm step in place); a phone row on the Security page
  (read-only while SMS is off). `core/auth/phone.ts` mirrors the API's normaliser and adds
  `formatThaiMobile` (`081-234-5678`) and `thaiMobileValidator`.
- **Checked**: curl against the dev API with SMS read from stdout for add / change / remove,
  sign-in, wrong / locked / expired / reused codes, recent auth by step-up code and by password,
  every limit (cooldown, 3 per number, 10 per IP with unknown numbers counted, verify per IP,
  the daily cap for known and unknown numbers), another user's number (`409`), a disabled user
  (no SMS; `403` after the code), `SMS_PROVIDER=disabled` (`503` before token and body) and the
  same timing for known and unknown numbers; Playwright at 375×812 in th/en × light/dark for
  the Security row, the phone page (every state), sign-in by phone and SMS off. Tests: API 374
  (service, HTTP, Drizzle adapter, phone helpers, SMS length, redaction), web 134 (phone
  helpers, auth service, phone page, Security row, sign-in link, phone sign-in, SMS code
  screen).
- **Known**: through `ng serve`'s proxy every browser is one IP, so the 10 SMS starts per hour
  per IP is easy to hit while testing; empty `rate_limit_buckets` as in 4.1. Asking for a code
  for a number another user holds still costs one SMS: the `409` comes only at confirm
  (decided, rule 25). Only the `console` SMS provider has been used; the ThaiBulkSMS adapter
  waits for its account (backlog).

## Done: App shell (#3)

Web only: an installable PWA skeleton that opens offline, before any data feature exists.

1. **PWA**: ✅ `@angular/pwa`. `ngsw-config.json` prefetches the app shell (HTML, all JS chunks
   including lazy pages, CSS, icons) and has **no `dataGroups`**, so API responses are never
   cached; `/api/**` is also excluded from navigation fallback. `public/manifest.webmanifest`:
   `ตังค์ไปไหน`, `standalone`, portrait, `any` + `maskable` icons (`public/icons/`), plus an
   `apple-touch-icon`. `core/pwa/app-update.service.ts` shows "มีเวอร์ชันใหม่ → โหลดใหม่" under the
   header on `VERSION_READY` (also on an unrecoverable SW state) and re-checks for a new version
   whenever the app comes back to the foreground. The SW is off in `ng serve`; test PWA behaviour
   on `npm run build` output.
2. **Storage persistence helper**: ✅ `core/pwa/device-storage.service.ts`: `persist()`,
   `isPersisted`, `isInstalled` (`display-mode: standalone` or iOS `navigator.standalone`). Nothing
   calls `persist()` yet: #4a does, at the trust prompt. The account page shows both values.
3. **Bottom tab bar**: ✅ `layout/` (`AppShell` is the layout route; header + page + fixed bar).
   ธุรกรรม / กระเป๋า / raised ➕ (→ `/transactions/new`) / รายงาน / บัญชีผู้ใช้, each a lazy feature
   route with an empty page. Safe-area insets on header and bar; `core/viewport/keyboard.service.ts`
   hides the bar when the visual viewport shrinks by > 150px (on-screen keyboard).
4. **Dark mode**: ✅ `core/theme/theme.service.ts`, key `tpn-theme` (absent = system). An inline
   script in `index.html` applies it before boot (no white flash) and sets `theme-color`. The picker
   lives on the account page.
5. **Online/offline indicator**: ✅ `core/network`, shown by the header's `layout/sync-status`.
6. **Checked**: `npm run build` emits `ngsw-worker.js`. Served from `dist/` with an SPA fallback,
   Playwright (375×812, light and dark) opened the app once, went offline, reloaded and saw the tab
   bar and "ออฟไลน์", and opened lazy tabs offline. It also checked the theme override survives a
   reload, the bar hides with a shrunk visual viewport, and the update banner appears after a new
   build is deployed and reloads into it.

Known behaviour: Angular's SW only announces a new version to pages it served, so the very first
visit (before the SW controlled the page) sees the update on its next reload, not as a banner.

## Done: Local dev workflow (#1)

Goal: every feature can be built **and tested** inside a Claude Code sandbox (or the owner's PC),
with no deploy and no third-party API keys.

1. **API**: `cd api && npm run setup-env && npm run dev` serves `http://localhost:3000`. `.env.dev`
   holds only local values. Secrets the app itself needs (JWT secret, `OTP_PEPPER`, …) are random
   values generated by `setup-env`, not keys from an outside service.
2. **Web**: ✅ `cd web && npm start` serves `http://localhost:4200`. `web/proxy.conf.json` forwards
   `/api/*` to `http://localhost:3000` and strips the `/api` prefix (`/api/health` → `/health`), the
   same mapping the prod rewrite will use. The browser sees one origin in dev as in prod, so the web
   calls relative `/api/...` URLs (no `apiUrl` in an environment file) and the auth cookie behaves
   the same. Node: Angular CLI needs `^22.22.3 || >=24.15`; the repo pins **24** in `.nvmrc` (same
   as CI).
3. **Database**: local SQLite file `api/data/local.db` (gitignored), set up in #2.
4. **Notifications**: ✅ `core/notification` (see `api/AGENTS.md` §2). One `notifier`, two channels
   (email, SMS), provider chosen by env:
   - `EMAIL_PROVIDER=console` (default) prints mail (to, subject, text with the code and link) to
     **stdout**, not through the app logger, so log files never hold codes (auth rule 18).
     `EMAIL_PROVIDER=smtp` + `SMTP_URL` sends via **Nodemailer** (e.g. a local Mailpit at
     `smtp://localhost:1025`, no API key).
   - `SMS_PROVIDER=console` (default) prints the SMS; `disabled` makes sends fail with `503`.
   - `console` providers are refused when `NODE_ENV=production`.
5. **Features that need an outside key stay off** until their env vars are set: Google sign-in is
   disabled without `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (the endpoints return `404`, the web
   hides the button; `npm run dev:oidc` in `api/` is a local stand-in to test it). Scheduled jobs (auth cleanup, recurring #12) run as npm scripts locally
   instead of Vercel Cron.
6. **Testing a feature**: unit/integration tests (`npm test`) plus a real run in the sandbox: start
   both apps, exercise the API with `curl`, and check screens with Playwright (Chromium is
   pre-installed in Claude Code cloud sessions).
7. **Done**: both apps start with one command each and `GET http://localhost:4200/api/health`
   answers through the proxy. The console mailer was checked by calling `notifier` directly; the
   first real mail is `POST /auth/email/start`, so seeing it on stdout is part of Auth (#4)'s
   check, not a separate test endpoint.

## Done in code: Deploy (#17)

The plan written before #17, and where each item ended up:

1. **GitHub** (`develop` default, branch protection): owner, docs/deploy.md step 1.
2. **API on Vercel**: `api/api/index.js` (the built app as one function) + `api/vercel.json`
   (rewrite everything to it, `includeFiles` for the OpenAPI spec). `PORT` defaults to 3000,
   `LOG_FILE_ENABLED=false` keeps logs on the console. Auth cleanup is `GET /auth/cleanup` (and
   sync's `GET /sync/cleanup`), Vercel Cron sends `GET` with `CRON_SECRET`. The request log ends
   with `:remote-addr` to check `TRUST_PROXY_HOPS`. Graceful shutdown doesn't run on Vercel.
3. **Web on Vercel**: `web/vercel.json` (SPA fallback outside `/api`, no-cache for `index.html`
   and the service worker) + `web/middleware.js` for `/api/*`.
4. **Claude Code GitHub Action**: not done (not needed for staging); still open.
5. **Previews**: both projects skip builds when their folder didn't change since the branch's last
   successful deployment (`ignoreCommand` on `VERCEL_GIT_PREVIOUS_SHA`; no previous deployment,
   or a SHA the shallow clone lacks, builds);
   the web's Preview `API_ORIGIN` is the API's `develop` URL.
6. **Mail/SMS**: Resend via `SMTP_URL`; SMS later (backlog).

## Done: Database foundation (#2)

- `drizzle-orm` + `@libsql/client` + `drizzle-kit`. `DATABASE_URL` = `file:./data/local.db` in dev,
  `libsql://…turso.io` + `DATABASE_AUTH_TOKEN` in prod.
- `src/core/database/` exports the client. `onShutdown` closes it locally.
- Schema lives in `src/core/database/schema/<feature>.ts` (one file per feature). Migrations are
  generated by drizzle-kit and committed.
- Seed script for dev data.
- ✅ All of the above: see `api/AGENTS.md` §2 "Database" for how to add a table. No tables exist
  yet; each feature adds its own (`schema/<feature>.ts` + a generated migration).
- Still open: delete the starter's `todo` reference feature once the first real layered feature exists, and
  point `AGENTS.md` at that feature instead (see `AGENTS.md` §9).

---

## Locked decisions

Agreed with the user. Do not re-propose alternatives unless asked.

**Architecture**

- **One repo, two folders** (`api/`, `web/`), each deployed as its own Vercel project. This is
  simple on purpose: no monorepo tool (no Nx, no npm workspaces) and no shared package. One repo
  means one Claude Code session (from a phone) sees the specs and both apps at once.
- **API pattern = `node-express-ts-starter`**: feature folders, Clean Architecture inside a feature,
  factories with deps objects, `createResponse` envelope, domain errors. See `api/AGENTS.md`.
- **Database = SQLite**, via **Drizzle ORM** + `@libsql/client`: a local file in dev, **Turso** in prod.
- **Web = Angular**, client-side only (no SSR/SEO needed for a private app). **UI = Tailwind v4 +
  spartan/ui**, shipped as an installable **PWA** (not Ionic, not Capacitor). It behaves like a
  mobile app: bottom tab bar, bottom sheets, safe areas.
- **UI in Thai and English**, Thai by default, switched at runtime with no reload (Transloco;
  there's no SSR/SEO, so no per-language builds). Translations are bundled so both work offline.
  Formats follow the language, with the **Gregorian year in both** (ค.ศ., owner's choice in #8,
  replacing พ.ศ. in Thai). Names that read oddly
  in Thai stay English (theme names). Details: `web/AGENTS.md` → UI text, `web/DESIGN.md` §11.
- **Look: selectable themes.** Midnight Gold (navy + gold) by default, plus Indigo Night, Gold
  Coin and Plum, each with light and dark; Noto Sans Thai (loopless) self-hosted. See
  `web/DESIGN.md` §3–4.
- **Same origin via rewrite.** The web project rewrites `/api/*` to the API project, so the browser
  only ever talks to the web origin. That keeps the refresh cookie first-party. `*.vercel.app` is on
  the Public Suffix List, so two `*.vercel.app` projects are cross-site to each other, and a
  `SameSite` cookie set by the API's own domain would not be sent. No CORS is needed in prod.
- **Local-first.** Until Deploy (#17), both apps run only locally (sandbox or the owner's PC). No
  feature may require a third-party API key to run or test; anything that needs one is off when its
  env vars are missing.
- **Notifications = pluggable providers** behind `core/notification`: one `notifier`, email + SMS
  channels, provider picked by env (`EMAIL_PROVIDER`, `SMS_PROVIDER`). Email uses **Nodemailer**
  SMTP; dev prints to stdout. Real providers (prod mail, an SMS gateway) are added as adapters at
  #17 or when a feature needs them.
- **Lint baseline is shared by convention.** The web `eslint.config.mjs` mirrors the API's baseline
  rules (import order, `@/` alias, no `../` imports, unused imports, type-aware TS rules) and adds
  angular-eslint. Change a baseline rule in both repos together.

**Money & data**

- **Amounts are integers in the currency's minor unit** (satang for THB). There are no floats
  anywhere, API or DB. The API returns `{ amount, currencyCode }`, and the web formats it with `Intl`.
- **Currency is a master table** (ISO 4217 code, minor-unit digits, active flag). Only **THB** is
  active at launch; others can be switched on later. Names come from `Intl.DisplayNames` on the web,
  so they aren't stored.
- **A wallet has exactly one currency.** Its transactions inherit it. There is no FX conversion in
  the MVP, and totals across currencies are shown per currency.
- **Every user-owned row carries `userId`** (its owner), and every query is scoped by it. The one
  exception is a wallet shared through `wallet_members`: members reach that wallet and its
  transactions by their role ([offline-sync](docs/features/offline-sync.md) rules 13–16).
- **IDs are UUIDv7 strings** (time-sortable). Timestamps are stored as integer epoch ms. Calendar
  dates of transactions are stored as `YYYY-MM-DD` in the user's timezone (default `Asia/Bangkok`).

**Offline-first** (full spec: [docs/features/offline-sync.md](docs/features/offline-sync.md))

- **Works fully offline on trusted devices.** The web app reads and writes an **encrypted local
  database**; changes go to an outbox and sync with the server when online (push, then pull). The
  server is the meeting point and the authority, not the screen's data source.
- **Synced rows are sync-ready**: the device generates the UUIDv7 `id`; `updatedAt`; **soft delete**
  via `deletedAt` (tombstones); a server-assigned `changeSeq` as the pull cursor.
- **Balances and totals are always computed** from transactions, never stored.
- **Local data on every device + optional PIN** (changed after 16.2; was "trusted device +
  PIN"): every signed-in device keeps its data in an encrypted local DB, made at its first open,
  with no question asked. The PIN is optional and off by default; when on, it unlocks the app and
  wraps the key that encrypts the local DB, and the app locks on open and after 5 min. 5 wrong
  PINs, a revoked session, sign-out, or a different user signing in **wipe** the local data; an
  expired session only sends the user to sign-in (the data kept).
- **Local DB = SQLite WASM in memory** + one encrypted snapshot in IndexedDB (decided by a spike
  at the start of #4a), and the app runs in one tab at a time.
- **Conflicts**: the later edit wins between the same user's devices; delete beats edit; the
  losing version is kept in `change_history` and the loser is told. In a shared wallet **the
  owner always wins**, even over an editor's delete, and the editor isn't told (16.2).
- **Shared wallets**: owner = full offline. Editor = add / edit / delete transactions **online
  only** (16.2: no offline adds). Viewer = online, read only. Shared per **person and book**:
  one role over the wallets the owner switches on (16.1); the member picks the owner's book
  in the switcher and uses it like their own, online only (16.2,
  [sharing](docs/features/sharing.md)).

**Auth** (full spec: [docs/features/auth.md](docs/features/auth.md))

- Three ways to sign in (all built, #4): **email**, **Google**, or **phone OTP** (SMS, only for a number already
  verified on an existing account; no sign-up by phone). Email defaults to **passwordless** (one 6-digit OTP +
  magic link in the same email). A user may **optionally set a password** and then sign in with
  email + password.
- **The `users` table holds no password.** Credentials live in their own tables
  (`password_credentials`, `user_identities`).
- **Open sign-up**: anyone who can read their email can create an account. `SIGNUP_ENABLED=false`
  closes sign-up as a kill switch; a global daily email cap (`EMAIL_DAILY_LIMIT`) limits abuse.
  Family members join by **invitation** to a shared wallet (#16), matched on their verified email.
  (Replaced the earlier invite-only allowlist.)
- The rules follow current OWASP guidance (ASVS 5.0, Authentication / Password Storage / Session
  Management / OAuth 2.0 cheat sheets) and NIST SP 800-63B-4. Specifics are in the spec.
  **One deliberate exception**: the password policy is 8+ characters with all four character
  classes (owner's choice, spec rule 11), not NIST's 15+ without composition rules.

---

## Backlog / open questions

- **SMS gateway account**: SMS is for phone-OTP sign-in (auth spec rules 21–27), gateway =
  **ThaiBulkSMS**. Its adapter (`sms.thaibulksms.ts`) is written when the account and API key
  exist; until then dev uses the `console` SMS provider. Later (owner, 2026-11), together with
  **Google sign-in**: both stay off on staging (env only) until the owner turns them on.
- **Production deploy** (#17 went up as staging only, owner 2026-11): when the family uses the
  app for real, set up production by [docs/deploy.md](docs/deploy.md) (Vercel `main`, its own
  Turso, Resend and Turnstile keys, the daily cron jobs) and run every migration on its database
  first.
- **Budget** (was #11, moved here after #10 by the owner: never used in Money Lover, and the
  Reports tab already shows spending per category against the months before). If a family
  member asks for it: per category or total per period, progress and an over-budget warning;
  the spending is `ReportService.byCategory` / `categoryTotal` (report.md → Volume), and it
  would sit in the Reports tab (the tab bar has no free slot). Needs a synced table.
- **Debt / loan**: built in #13 (debt.md). Left for later if asked: interest from a rate,
  reminders before a due date (#17), weekly / yearly instalment plans, editing a repayment
  rule's schedule, a "หลังหักหนี้" line under ยอดรวม, a share text of a debt's history.
- **FX / multi-currency reports**: convert to THB with daily rates. Not before the 25
  currencies of #23 are used for a while.
- **Import from Money Lover** (CSV export → our transactions). Decide after #8.
- **Full edit history in a share** (after #21, if the latest action per row isn't enough): a
  server table written on every applied push to a shared wallet, with the values before and
  after ("500 → 450 → 480"), kept **30 days** by the existing cleanup cron, read online by
  everyone in the share. Not on the device (owner, 2026-11): a device only sees each pull's
  state, so edits between pulls would be lost, each device would differ and a member keeps
  nothing (shared-activity.md → Out of scope). Restoring a row someone else deleted could come
  with it.
- **Longer shared refresh while live** (live-sync decision 1): a device with a live connection
  could stretch the shared book's 1-minute read to 5 minutes. Not before Ably runs on
  staging for a while.
- **Live updates of sharing** (after #20): poke the `user:` channel when an invite arrives or a
  member's role or wallets change, so the Account tab's dot and the switcher update at once.
  Invites are rare, so the next app open is enough for now.
- **End-to-end tests (Playwright)** (owner, 2026-11: start once the wanted features are done):
  `@playwright/test` in `web/`, starting the API on an empty database and `ng serve`. A few smoke
  paths first: sign up with an email code (read from the `console` email provider), first book
  and wallet, a transaction that syncs, edit profile, sign out. Chromium and WebKit (closest to
  Safari) at phone size; into CI once they are steady. Today Playwright is only a manual check
  per feature ("How we build a feature" step 3) and nothing tests the web against the real API.
- **Copy categories into a new book**: not wanted (owner, 2026-11). A new book gets only the
  default set, in the language the app has when the book is made (category rule 8); books stay
  apart, so one book's own categories ("เกม Genshin") never follow into another. A new wallet
  in the same book sees all of its book's categories (hide some per wallet, rule 13).
