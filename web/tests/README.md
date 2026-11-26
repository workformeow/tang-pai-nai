# End-to-end tests (Playwright)

The plan and progress of the web app's end-to-end tests. **A new session starts here**: read
"Status" to see which step is next, then the step's notes. Tick a step and add what was learned
when its commit lands. Backlog entry in [`ROADMAP.md`](../../ROADMAP.md) → "End-to-end tests".

## Status

| Step | What                                                                       | State |
| ---- | -------------------------------------------------------------------------- | ----- |
| 0    | Groundwork: global setup, helpers, fixtures, remove the generated files    | ⬜    |
| 1    | Sign up with an email code → display name → first book                     | ⬜    |
| 2    | Wrong input: bad email, wrong code (`OTP_INVALID`), 5 wrong (`OTP_LOCKED`) | ⬜    |
| 3    | Rate limits: too many wrong passwords, too many code requests              | ⬜    |
| 4    | First wallet + a transaction → synced, still there after a reload          | ⬜    |
| 5    | Edit profile (display name)                                                | ⬜    |
| 6    | Sign out → sign-in page, local data wiped                                  | ⬜    |
| 7    | Into CI (`.github/workflows/web.yml` at the repo root), once steady        | ⬜    |

✅ done · 🚧 in progress · ⬜ not started

**Working rules** (owner, 2026-11-26): one commit per test (step), on the branch `test/web-e2e`;
the owner's "Edit until the owner says OK" rule (root `CLAUDE.md`) applies as for any change.

## Decisions

- **Where**: `web/tests/*.spec.ts`, config `web/playwright.config.ts`, typed by
  `web/tsconfig.e2e.json` (so ESLint's project service and `npm run typecheck` cover them).
  `tests/` is outside `src/`, so `ng test` (Vitest) never picks them up. Run with `npm run e2e`.
- **Browsers**: Chromium (Pixel 7) and WebKit (iPhone 15, closest to Safari), phone size.
- **No API change**: the tests drive the API exactly as it ships, with an e2e env.

### API env for e2e

| Key                        | Value                | Why                                  |
| -------------------------- | -------------------- | ------------------------------------ |
| `DATABASE_URL`             | `file:./data/e2e.db` | own database, never `local.db`       |
| `EMAIL_PROVIDER`           | `console`            | the code is read from stdout (below) |
| `TURNSTILE_*`              | empty                | bot check off                        |
| `PASSWORD_BREACH_CHECK`    | off                  | no call to HIBP                      |
| `LIVE_PROVIDER`            | `disabled`           | live sync isn't tested yet           |
| `DEMO_ENABLED`             | `false`              |                                      |
| `JWT_SECRET`, `OTP_PEPPER` | random per run       | required by the API                  |
| `TRUST_PROXY_HOPS`         | `1`                  | per-test IP (rate limits, below)     |

### Reading the email code

With `EMAIL_PROVIDER=console` the API prints every mail to stdout
(`api/src/core/notification/email.console.ts`): a block with `To: <email>`, the 6-digit code and
the magic link. Global setup starts the API itself and writes its stdout to
`test-results/api.log`; `readCode(email)` takes the newest block whose `To:` is that email.
Codes are stored hashed, so the database can't give them back.

### A clean start for every test

- **Every run**: global setup deletes `data/e2e.db`, migrates it, then starts the API; `ng serve`
  runs through Playwright's `webServer` (port 4200, `/api` via `proxy.conf.json`).
- **Every test**: Playwright gives each test a new browser context (cookies, localStorage,
  IndexedDB empty), and each test signs up its own user with a unique email
  (`e2e-<uuid>@example.test`). Nothing carries over between tests.
- **Tests that need a signed-in user**: the `signedIn` fixture signs up through the API with
  `page.request` (same cookie jar as the page), then `page.goto('/')` restores the session.
  Only step 1 signs up through the UI.

### Rate limits

Limits live in the `rate_limit_buckets` table (`api/src/features/auth/auth.const.ts`), per email
and **per IP**. Every test comes from 127.0.0.1, so 20 sign-ups in a run would hit
`STARTS_PER_IP`, and a test that fills a limit on purpose would block the others.

- **Per-test IP**: each test sends its own `X-Forwarded-For: 10.x.x.x` (`extraHTTPHeaders`), and
  the API (`TRUST_PROXY_HOPS=1`) counts it as the client, so buckets never meet.
  **To check in step 0**: that `ng serve`'s proxy passes the header on. If it doesn't, the
  fallback is a fixture that empties `rate_limit_buckets` in `e2e.db` before each test, with
  one worker.
- **Testing a limit** checks the message, never waits for the window to end: e.g. 5 wrong
  passwords (`PASSWORD_FAILURES_PER_EMAIL`), then the 6th try shows `RATE_LIMITED` with the
  wait, even with the right password.

## Step notes

Add here what each step found (selectors that needed a test id, timing, flaky parts).
