# Demo

> Status: **Spec** (#25). Agreed with the owner 2026-11-17. Builds on [auth.md](auth.md)
> (sessions, Turnstile, the cleanup cron), [offline-sync.md](offline-sync.md) (first pull,
> rule 7) and [loading.md](loading.md) rule 4.

## Purpose

The owner shows the app when applying for jobs. Someone opening the link and meeting a sign-in
page closes it. **ทดลองใช้ Demo** gives them, in one tap and without an email, an account of
their own **filled with realistic data**, so they see a working personal income / expense tracker
straight away, and see that the backend, the sync and the offline database are real: the data
is seeded on the server and pulled to the device like any account's.

## Out of scope

- **Sharing** (owner, 2026-11-17): the app is presented as a personal tracker; a demo has no
  second person, no shared book and no invites (rule 9).
- A shared demo account (everyone on one account, reset by a cron): with offline-first, each
  device keeps its own copy and outbox, so a reset fights the devices that still hold the old
  rows, and visitors would see each other's edits arrive.
- A front-end-only demo with mock data: it would not show the API or the sync.
- Turning a demo into a real account. A visitor who wants one signs up normally; the demo's data
  doesn't follow.

## Data model

- `users.isDemo` (boolean, default `false`; new migration). Everything else is the normal
  tables: the demo user owns one book with its wallets, categories, transactions and so on.
- The demo user's `email` is a placeholder no mail can reach: `demo-<id>@demo.invalid`
  (`.invalid` is reserved, RFC 2606). Nothing ever sends to it (rule 9). Display name
  "ผู้ทดลองใช้" / "Demo user" in the language of rule 4.

## Business rules

**Starting**

1. `DEMO_ENABLED` (API env, per environment): on for **staging and production** (owner,
   2026-11-17: production too, to show and explain the app), off by default (local dev,
   tests). `GET /auth/providers` answers `demo: true | false`; while off the button and the
   page (rules 2–3) don't show and `POST /auth/demo` is `404`.
2. The sign-in page has a **ทดลองใช้ Demo** button (under the sign-in forms, above the privacy
   line). It **links to `/auth/demo`**; it doesn't start a demo by itself.
3. **`/auth/demo`** (open without signing in, the sign-in layout like `/auth/install`): what the
   app is in two or three lines, what the demo holds, "ข้อมูลจะถูกลบใน 24 ชั่วโมง", what is turned
   off (rule 9), the Turnstile widget and one button **เริ่มทดลองใช้**. This is the link to put
   in a resume. Opening the page creates nothing; only the button does (link previews and bots
   open links).
4. The button calls `POST /auth/demo` with the Turnstile token and the UI language. The API, in
   **one transaction**: creates the user (`isDemo`), one book and its seed data (rules 6–7),
   and a session (the normal refresh cookie, auth.md); it answers like a sign-in. A failure
   leaves nothing behind.
5. Limits: Turnstile (auth.md rule 32, the same on/off and fail-open), plus **5 demos per IP
   per hour** in `rate_limit_buckets` (`demo:ip:<hash>`); over it `429 RATE_LIMITED` with
   `Retry-After`, and the page shows the wait.

**The seed**

6. One book in the request's language, with the default categories of that language
   (category rule 8), and:
   - wallets: เงินสด, a bank account, a **credit card** (#18), a savings wallet excluded from
     the total;
   - about **3 months** of everyday income and expenses up to **today** (salary, food,
     transport, bills, shopping), sized like a Thai salary;
   - transfers (a card payment, savings);
   - **recurring** rules (rent, a subscription), one of them asking first so the due card shows;
   - one **debt** (lent to a friend, partly repaid);
   - one **event**: a trip abroad in a **second currency** (a JPY wallet), so the Reports
     currency chips and ภาพรวม (#24) have something to show.
7. Dates are **relative to the day the demo starts** (the user's timezone, Asia/Bangkok by
   default): "this month" always has data, and the recurring pass finds nothing missing. The
   seed is fixed (the same amounts every time, from a template in the API), not random.

**Loading**

8. After rule 4 answers, the app opens the device database and runs the first pull as any new
   device does (loading.md rule 4), but the loader is a **checklist** for a demo, each line
   ticked when its step really ends (no fake delays):
   1. สร้างบัญชี Demo (rule 4 answered);
   2. เตรียมเครื่อง (the local database exists);
   3. ดาวน์โหลดกระเป๋าและหมวดหมู่ (the pull's master and book tables are in);
   4. ดาวน์โหลดรายการ n รายการ (`SyncService.pulledRows`, until the round ends);
   then it goes straight to the **Transactions** tab. A failed step shows its error and
   **ลองใหม่** (back to `/auth/demo`).

**While in a demo**

9. **Turned off, with a note** (owner, 2026-11-17: shown disabled, not hidden): change email,
   set or change a password, link Google, add a phone, share a book (invite, Account ›
   แชร์กระเป๋า), delete the account. Each shows "ใช้ไม่ได้ในโหมด Demo" / "Not available in the
   demo". The API refuses the same routes for a demo user with `403 DEMO_NOT_ALLOWED`, so
   nothing can send a mail or an SMS from a demo. Everything on the device works as usual (PIN,
   CSV export, theme, language, quick amounts).
10. A **banner** at the top of the shell: "โหมด Demo · ข้อมูลจะถูกลบใน n ชั่วโมง" (hours left,
    from the user's `createdAt`).
11. **Size cap**: a demo user's push is refused past **2,000 own rows** (seed included), as a
    rejected op with `DEMO_LIMIT`, so a demo can't be used to store anything.
12. Account's ออกจากระบบ becomes **จบ Demo**: it asks once ("ข้อมูล Demo จะถูกลบทันที"), then
    `DELETE /auth/demo` deletes the user at once (as the account deletion of privacy.md rule
    8, no mail, no recent auth), the device wipes and goes to sign-in.

**Expiry**

13. The daily auth cleanup cron (auth.md rule 20) deletes demo users created more than **24 hours**
    ago, with everything under them (`onDelete: 'cascade'`).
14. A device still holding a deleted demo: its next refresh is refused like a revoked session,
    the app wipes the local data (offline-sync rule 7) and the sign-in page says "Demo
    หมดเวลาแล้ว" with a link to `/auth/demo`.

## Endpoints

| Method | Path              | Auth   | What                                                         |
| ------ | ----------------- | ------ | ------------------------------------------------------------ |
| POST   | `/auth/demo`      | —      | `{ botToken, lang }`; creates the demo user and seed (rule 4) |
| DELETE | `/auth/demo`      | Bearer | จบ Demo: deletes the caller, a demo user only (rule 12)       |
| GET    | `/auth/providers` | —      | Gains `demo` (rule 1)                                        |

Error codes: `DEMO_DISABLED` (404), `DEMO_NOT_ALLOWED` (403), `DEMO_LIMIT` (a rejected op),
`BOT_CHECK_FAILED`, `RATE_LIMITED`. `AuthUser` gains `isDemo`.

## Web screens

- Sign-in page: the ทดลองใช้ Demo button (rule 2).
- `/auth/demo`: rule 3's page.
- The shell's loading gate: the checklist of rule 8 for a demo.
- The demo banner (rule 10), the disabled rows with their note (rule 9), จบ Demo (rule 12),
  the expired line on sign-in (rule 14).

## Interactions

- **Auth**: `POST /auth/demo` issues a session like any sign-in; the cleanup cron gains rule 13.
- **Sync**: the seed is ordinary rows with change sequences, so the first pull brings them;
  rule 11's cap is checked on push.
- **Privacy** ([privacy.md](privacy.md)): the notice mentions that a demo keeps no personal data
  and is deleted after 24 hours.

## Decisions

- Q1 (owner, 2026-11-17): the seed's exact rows (names, amounts, which days) are a template in
  the API, drafted and reviewed with the owner before the API is built.
- Q2 (owner, 2026-11-17): the banner can't be closed; it is one thin line.
