# End-to-end tests (Playwright)

The plan and progress of the web app's end-to-end tests. **A new session starts here**: read
"Status" to see which step is next, then the step's notes. Tick a step and add what was learned
when its commit lands. Backlog entry in [`ROADMAP.md`](../../ROADMAP.md) → "End-to-end tests".

## Status

| Step | What                                                                       | State |
| ---- | -------------------------------------------------------------------------- | ----- |
| 0    | Groundwork: API start-up, helpers, fixtures, remove the generated files    | ✅    |
| 1    | Sign up with an email code (UI) → signed in, on the first-book step        | ✅    |
| 2    | Create the first book (UI); given: a user                                  | ✅    |
| 3    | Create the first wallet (UI); given: a user + a book (`withBook`)          | ✅    |
| 4    | Add a transaction (UI) → synced, there after a reload; given: `withWallet` | ✅    |
| 5    | Wrong input: bad email, wrong code (`OTP_INVALID`), 5 wrong (`OTP_LOCKED`) | ✅    |
| 6    | Rate limits: too many wrong passwords, too many code requests              | ✅    |
| 7    | Edit profile (display name)                                                | ✅    |
| 8    | Sign out → sign-in page, local data wiped                                  | ✅    |
| 9    | Into CI (`.github/workflows/e2e.yml` at the repo root), once steady        | ✅    |
| —    | Later, if wanted: one journey test through the UI end to end (`test.step`) | ⬜    |

Steps 5 and 6 are one test per case (one wrong input, one limit each), not one test for all.

✅ done · 🚧 in progress · ⬜ not started

**Working rules** (owner, 2026-11-26): one commit per test (step), on the branch `test/web-e2e`;
the owner's "Edit until the owner says OK" rule (root `CLAUDE.md`) applies as for any change.

## How to run

From `web/`. Playwright starts the API and `ng serve` itself; nothing else needs to run, and
`npm run dev` may run beside it. The first run waits for `ng serve` to build (about a minute).

| Script                 | What                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| `npm run e2e`          | every test, both browsers; the result in the HTML report (`e2e:report`)      |
| `npm run e2e:list`     | the same, each test and its `console.log` printed in the terminal            |
| `npm run e2e:chromium` | Chromium only, printed in the terminal: the quick loop while writing a test  |
| `npm run e2e:ui`       | UI mode: run, step back through each action, pick locators, see the console  |
| `npm run e2e:headed`   | Chromium in a visible window                                                 |
| `npm run e2e:debug`    | Chromium with the Inspector, stopping at each action (and at `page.pause()`) |
| `npm run e2e:report`   | opens the last HTML report (screenshots, traces, stdout of failed tests)     |
| `npm run e2e:codegen`  | records clicks into test code against the **dev** app (`npm run dev`, 4200)  |

One file or test: add it after `--`, e.g. `npm run e2e:chromium -- tests/sign-up.spec.ts` or
`npm run e2e:chromium -- -g "signs up"`.

## Files

| File                              | What                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `playwright.config.ts`            | browsers, ports, the two `webServer`s (API, `ng serve --ssl`)                                                                  |
| `tsconfig.e2e.json`               | types the config and `tests/` (ESLint's project service, `typecheck`)                                                          |
| `tests/package.json`              | `"type": "module"` for `tests/` only (`import.meta`; the app has none)                                                         |
| `tests/support/start-api.ts`      | new `api/data/e2e.db`, migrate, start the API with the e2e env and log                                                         |
| `tests/support/proxy.e2e.json`    | `/api` → API on 3100, `Origin: https://localhost:4300`                                                                         |
| `tests/support/mail.ts`           | `readMail(email, after?)`: the newest code (and link) mailed to `email`                                                        |
| `tests/support/fixtures.ts`       | `test` / `expect` for every spec: `email`, `clientIp`, `signIn`, `withBook`, `withWallet`                                      |
| `tests/support/api.ts`            | through the API: `signUp`, `getMe`, `setPassword`, `askForCode`, `pushRows`, `pullRows`, `bookRow`, `categoryRow`, `walletRow` |
| `tests/groundwork.spec.ts`        | step 0: sign-in through the API, per-test IP rate limits                                                                       |
| `tests/sign-up.spec.ts`           | step 1: sign up through the UI                                                                                                 |
| `tests/first-book.spec.ts`        | step 2: create the first book through the UI                                                                                   |
| `tests/first-wallet.spec.ts`      | step 3: create the first wallet through the UI                                                                                 |
| `tests/wrong-input.spec.ts`       | step 5: a bad email, a wrong code, a locked code (one test each)                                                               |
| `tests/rate-limits.spec.ts`       | step 6: too many wrong passwords, too many code requests (one test each)                                                       |
| `tests/edit-profile.spec.ts`      | step 7: change the display name from the Account tab                                                                           |
| `tests/sign-out.spec.ts`          | step 8: sign out from the Account tab, the vault gone, still signed out after a reload                                         |
| `tests/first-transaction.spec.ts` | step 4: add a transaction through the UI, reload, read it back from the server                                                 |

## Decisions

- **One test, one behavior** (owner, 2026-11-26): a test drives the UI only for the one thing it
  is about; everything before it (a user, a book, a wallet) comes from a **fixture through the
  API**, never through the UI another test covers. So a broken wallet screen fails the wallet
  test alone, and the transaction test still runs and passes. A fixture that fails says so in
  its message (`fixture withWallet: push failed …`), so a setup failure never reads as a bug in
  the screen under test. A journey test through the whole UI is optional and comes last.
- **Where**: `web/tests/*.spec.ts`; `tests/` is outside `src/`, so `ng test` (Vitest) never picks
  them up. Every spec imports `test` and `expect` from `./support/fixtures`, never from
  `@playwright/test`.
- **Browsers**: Chromium (Pixel 7) and WebKit (iPhone 15, closest to Safari), phone size.
- **Ports**: API **3100**, web **4300**, not dev's 3000 / 4200, so `npm run dev` can run at the
  same time. The API is never reused (a new database every run); `ng serve` is reused locally.
- **HTTPS**: the web is `ng serve --ssl` (its own certificate, `ignoreHTTPSErrors`). WebKit
  doesn't keep the `Secure` refresh cookie (`__Host-rt`) on plain `http://localhost` (Chromium
  does), so over HTTP a WebKit test is signed out after every reload. The API stays plain HTTP
  behind the proxy, as in dev.
- **No API change**: the tests drive the API exactly as it ships, with an e2e env.
- **CI** (step 9): its own workflow, `.github/workflows/e2e.yml`, run on every PR and push to
  `develop` / `main` that touches `web/` **or `api/`** (a change to either can break the
  pair); `web.yml` and `api.yml` stay as they were, so an API-only change doesn't rerun the
  web's unit tests and build. It installs `api/` and runs its `setup-env` (the API exits
  without `.env.dev` in development; `start-api.ts` sets every value it reads itself), then
  `npm run e2e`. With `CI` set, `playwright.config.ts` runs one worker, retries a failed test
  twice (a trace of each retry), never reuses `ng serve`, and prints each test to the log; the
  HTML report, `test-results/` and `playwright/api.log` go up as the `playwright-report`
  artifact (14 days), pass or fail.

### API env for e2e (`start-api.ts`)

| Key                          | Value                    | Why                                        |
| ---------------------------- | ------------------------ | ------------------------------------------ |
| `DATABASE_URL`               | `file:./data/e2e.db`     | own database, never `local.db`             |
| `EMAIL_PROVIDER`             | `console`                | the code is read from stdout (below)       |
| `WEB_ORIGIN`, `CORS_ORIGINS` | `https://localhost:4300` | the e2e web's origin                       |
| `TURNSTILE_*`                | empty                    | bot check off                              |
| `PASSWORD_BREACH_CHECK`      | `off`                    | no call to HIBP                            |
| `EMAIL_DAILY_LIMIT`          | `100000`                 | the server-wide cap (100) is below one run |
| `LIVE_PROVIDER`              | `disabled`               | live sync isn't tested yet                 |
| `DEMO_ENABLED`               | `false`                  |                                            |
| `JWT_SECRET`, `OTP_PEPPER`   | random per run           | required by the API                        |
| `TRUST_PROXY_HOPS`           | `1`                      | per-test IP (rate limits, below)           |
| `LOG_FILE_ENABLED`           | `false`, console `warn`  | no files in `api/logs`, quiet output       |

### Reading the email code

With `EMAIL_PROVIDER=console` the API prints every mail to stdout
(`api/src/core/notification/email.console.ts`): a block with `To: <email>`, the 6-digit code and,
for sign-in, the magic link. `start-api.ts` writes the API's stdout to `web/playwright/api.log`
(git-ignored, emptied every run); `readMail(email)` waits up to 10 s for the newest block to that
email. For a resend, pass the mail read before: `readMail(email, first)` waits for a newer one.
Codes are stored hashed, so the database can't give them back.

### A clean start for every test

- **Every run**: `start-api.ts` deletes `api/data/e2e.db`, migrates it, then starts the API.
- **Every test**: Playwright gives each test a new browser context (cookies, localStorage,
  IndexedDB empty), and the `email` fixture is a new address (`e2e-<uuid>@example.test`), so
  each test has its own user. Nothing carries over between tests.
- **Tests that need a signed-in user** call `await signIn()` (it answers the access token): it signs `email` up through the
  API with `page.request` (same cookie jar as the page), then opens `/`, where the session is
  restored. A new user lands on the first-book step ("สร้างสมุดแรก"). Only step 1 signs up
  through the UI.
- **Tests that need data** ask for a fixture that pushes it through `/api/sync/push` before the
  app opens (`tests/support/api.ts`: `signUp`, `pushRows`, `bookRow`), so the app's first pull
  brings it in. `withBook` = a signed-in user with one book "ครอบครัว" and no wallet; it waits
  until the header names the book. A pushed book has **no categories** (the app writes the
  default set only when the book sheet creates a book); a fixture that needs them pushes them.
  `withWallet` = a user with book "ครอบครัว", one expense category "อาหาร" and a THB wallet
  "เงินสด" of ฿1,000 (pushed in that order: a row after the rows it points at); it waits for
  "ยอดรวม ฿1,000.00" and hands over the user's `token`.
- **What reached the server** is read back with `pullRows(request, token, table)`, the rows
  another device's first pull would get. A second device can't sign in by code in the same
  test: the API waits a minute between codes to one email (`RESEND_COOLDOWN_MS`).

### Rate limits

Limits live in the `rate_limit_buckets` table (`api/src/features/auth/auth.const.ts`), per email
and **per IP**. Every test comes from 127.0.0.1, so 20 sign-ups in a run would hit
`STARTS_PER_IP`, and a test that fills a limit on purpose would block the others.

- **Per-test IP** (checked in step 0, works): the `clientIp` fixture is a random `10.x.x.x` sent
  as `X-Forwarded-For` on every request of the test (`extraHTTPHeaders`); `ng serve`'s proxy
  passes it on and the API (`TRUST_PROXY_HOPS=1`) counts it as the client, so buckets never
  meet. A request can still set its own header to act as another client.
- **Testing a limit** checks the message, never waits for the window to end: e.g. 5 wrong
  passwords (`PASSWORD_FAILURES_PER_EMAIL`), then the 6th try shows `RATE_LIMITED` with the
  wait, even with the right password.

## Step notes

- **Step 0** (2026-11-26): `tests/groundwork.spec.ts` — `signIn()` reaches the first-book step;
  31 wrong verifies from one IP get `429` on the 31st (`VERIFIES_PER_IP` 30), another IP doesn't.
  4 tests, ~10 s, steady over `--repeat-each=3`. Found: WebKit needs HTTPS (above); Playwright
  loads `tests/` as CommonJS unless `tests/package.json` says `module`. Removed the generated
  `tests/example.spec.ts` and `web/.github/workflows/playwright.yml` (GitHub only reads the
  root `.github/`; CI is step 7). Assert something a signed-in page shows, not only
  `not.toHaveURL(/auth/)`: that passes before the redirect would happen.
- **Step 1** (2026-11-26): `tests/sign-up.spec.ts` — sign-in page → อีเมล → ส่งรหัส → the code
  from the mail into "รหัส 6 หลัก" → the first-book step. The sixth digit submits by itself: don't
  click เข้าสู่ระบบ after it (the button is disabled, then gone). The OTP input is found by its
  (screen-reader-only) label, `getByLabel('รหัส 6 หลัก')`; no test id needed. 2 tests, steady
  over `--repeat-each=3`.
- **Step 2** (2026-11-26): `tests/first-book.spec.ts` — `signIn()` → สร้างสมุด → ชื่อสมุด → บันทึก
  → the toast, the header's switcher "สมุด <name> เปลี่ยนสมุด", the first-wallet step, and the
  sync status button settling on "สถานะ sync: sync แล้ว …". That last check is how a test sees
  the server accepted a write without reading the database: a refused push stays on "รอ sync" or
  "sync ไม่สำเร็จ". It doesn't prove the row is on the server; a second device pulling it does
  (step 4). 2 tests, steady over `--repeat-each=3`.
- **Step 3** (2026-11-26): `tests/first-wallet.spec.ts` on `withBook` (the first fixture that
  pushes data) — เพิ่มกระเป๋าเงิน → ชื่อกระเป๋าเงิน, ยอดเงินเริ่มต้น 1500 → บันทึก → the toast,
  the Transactions tab with "ยอดรวม ฿1,500.00", "sync แล้ว", and the Wallets tab lists it. Right
  after a sheet closes, `ariaSnapshot()` still shows only the dialog: the page comes back into
  the accessibility tree when the close animation ends (not an app bug; `expect` waits through
  it). 2 tests, steady over `--repeat-each=3`.
- **Step 4** (2026-11-26): `tests/first-transaction.spec.ts` on `withWallet` — ➕ → the amount
  row → 2 5 0 on the keypad → หมวดหมู่ → อาหาร → บันทึก → the row "อาหาร เงินสด -250.00", "ยอดรวม
  ฿750.00", "sync แล้ว"; the same after a reload; `pullRows` finds the one transaction (25 000
  satang, the wallet and category ids). A plain save shows no toast (the row is the feedback).
  Found: **on iPhone the sheet opens with the keypad closed.** CDK counts only inputs as
  tabbable on iOS, so the drawer's `autoFocus: 'first-tabbable'` focuses the date field, whose
  `focusin` closes the keypad (`AmountKeypad.leave`). Chromium keeps it open. Fixed (owner OK):
  while the keypad is open, the transaction, transfer and debt-entry sheets set the drawer's
  `[autoFocus]` to `app-calc-amount-field button`; the test checks it on WebKit by typing on
  the keypad without tapping the amount row. 2 tests, steady over `--repeat-each=3`.
- **Step 5** (2026-11-26): `tests/wrong-input.spec.ts`, one test per case — "not-an-email" →
  "รูปแบบอีเมลไม่ถูกต้อง" and no code step; a wrong code → "รหัสไม่ถูกต้อง ลองอีกครั้ง", then the
  right one signs in; 4 wrong → "รหัสไม่ถูกต้อง", the 5th → "ใส่รหัสผิดหลายครั้งเกินไป …"
  (`MAX_CODE_ATTEMPTS`), and the right code after it is refused the same way. Each try waits
  for its `/api/auth/email/verify` answer (`enterCode`) and uses a different wrong code:
  without that, the message the try before left on screen passes the check while the next try
  hasn't been sent (WebKit lost tries that way). 6 tests, steady over `--repeat-each=3`.
- **Step 6** (2026-11-26): `tests/rate-limits.spec.ts`, one limit per test. Wrong passwords: a
  user with a password (`signUp` + `setPassword` through the `request` fixture, so the page
  stays signed out) → the password tab, 5 wrong → "อีเมลหรือรหัสผ่านไม่ถูกต้อง" each, then the
  right one → "ลองบ่อยเกินไป รออีก N นาทีแล้วลองใหม่" (`PASSWORD_FAILURES_PER_EMAIL`). Code
  requests: 20 starts for other emails from the test's IP (`askForCode`, in parallel), then the
  screen's 21st → the same message, no code step (`STARTS_PER_IP`); the per-email limits
  can't be filled fast, every start waits a minute after the last (`RESEND_COOLDOWN_MS`). The
  `request` fixture sends the test's `X-Forwarded-For` too (the 21st is refused only if the 20
  counted for the same IP). Found: the API caps mail **server-wide** at `EMAIL_DAILY_LIMIT` (100
  a day), so a run with repeats hit it; the e2e env raises it. Match the message in its
  `alert` (`getByRole('alert').filter({ hasText })`): an anchored `getByText` regex missed it.
  4 tests, steady over `--repeat-each=3`; the whole suite over `--repeat-each=2`.
- **Step 7** (2026-11-26): `tests/edit-profile.spec.ts` on `signIn()` — Account tab: the card
  shows the email's local part as the name → the card ("แก้ไขโปรไฟล์") → ชื่อที่แสดง → บันทึก →
  toast "บันทึกแล้ว", the card's name line; the same after a reload; `getMe` (`GET /auth/me`)
  has it, since the device's vault keeps the name and a reload alone proves nothing about the
  server. The card's accessible name is its `aria-label` only ("แก้ไขโปรไฟล์"), so its name
  and email are found inside it with `getByText(…, { exact: true })`. 2 tests, steady over
  `--repeat-each=3`.
- **Step 8** (2026-11-26): `tests/sign-out.spec.ts` on `withWallet` (data on the device) — the
  vault (IndexedDB `tpn-vault`) is there first → Account tab → ออกจากระบบ → the sheet says the
  device's data goes → its ออกจากระบบ → `/auth/sign-in`, the vault gone; a reload and `/` stay
  on sign-in (the server ended the session), with no "เครื่องนี้มีข้อมูลของ …" line (that one is
  for an expired session, which keeps the data). The `tpn-book:` keys a wipe also removes are
  written only once a book or view is chosen, so `offline.service.spec.ts` covers them. Found:
  WebKit's `indexedDB.databases()` can still list a database just deleted, so the "gone" check
  is polled (a vault written again after the wipe would stay and still fail it). WebKit logs
  "Importing a module script failed" from `ng serve` when a navigation cuts off a lazy chunk;
  it is noise, the tests pass. 2 tests, steady over `--repeat-each=5`.
- **Step 9** (2026-11-26): `.github/workflows/e2e.yml` (see Decisions → CI); the plan named
  `web.yml`, but a job there would need `api/**` in its triggers, rerunning the web's unit
  tests and build on every API change. `playwright.config.ts`: in CI the `list` reporter
  beside the HTML one. Checked locally with `CI=1` (one worker, no reuse): 26 tests in about a
  minute. Not checked until it runs on GitHub: the Ubuntu runner itself (Node from `.nvmrc`,
  WebKit's system packages from `--with-deps`, `ng serve --ssl` there). Once, before CI, steps 5
  and 6 each failed one test on Chromium in a full local run beside another run, and passed in
  every run after (no error kept); the retries in CI will show it as "flaky" if it comes back.
