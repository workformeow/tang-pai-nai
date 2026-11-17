# Demo

> Status: **Built** (#25, 2026-11-17). Agreed with the owner 2026-11-17. Builds on [auth.md](auth.md)
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
2. The sign-in page has a **ทดลองใช้ Demo** entry under the sign-in forms (and Google), above
   the privacy line: a divider "อยากลองก่อน?" / "Just looking?" and a card (icon, name, "ไม่ต้องใช้
   อีเมล ดูแอปพร้อมข้อมูลตัวอย่าง", ›), so it reads as another way in, not part of the form
   (owner, 2026-11-17). It **links to `/auth/demo`**; it doesn't start a demo by itself.
3. **`/auth/demo`** (open without signing in, the sign-in layout like `/auth/install`): what the
   app is in two lines, what the demo holds, "ข้อมูลจะถูกลบเมื่อกด "จบ Demo" หรือเมื่อครบ 24
   ชั่วโมง", what is turned off (rule 9), the Turnstile widget and one button **เริ่มทดลองใช้**. This is the link to put
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
   **ลองใหม่**, which pulls again (decided while building: going back to `/auth/demo` would
   make a second demo and leave the first for the cron). The rows come in one pull page, so
   lines 3 and 4 tick together.

**While in a demo**

9. **Turned off, with a note** (owner, 2026-11-17: shown disabled, not hidden): change email,
   set or change a password, link Google, add a phone, share a book (invite, Account ›
   แชร์กระเป๋า), delete the account. Each shows "ใช้ไม่ได้ในโหมด Demo" / "Not available in the
   demo". The API refuses the same routes for a demo user with `403 DEMO_NOT_ALLOWED`, so
   nothing can send a mail or an SMS from a demo: `PUT` / `DELETE /auth/password`,
   `/auth/reauth/*`, `POST` / `DELETE /auth/phone`, `/auth/phone/confirm`, `POST` / `DELETE
   /auth/google/link`, `GET /auth/account/deletion`, `DELETE /auth/account`, and sharing's
   invite, resend and accept (its reads still answer, empty: the app asks at start). A demo's
   address never gets a sign-in mail either. The web's Account and Security rows show turned
   off, and their pages send a typed address back to Account. The profile card shows "บัญชี
   ทดลอง ไม่มีอีเมล" instead of the placeholder address. Everything on the device works as usual (PIN,
   CSV export, theme, language, quick amounts).
10. A **banner** under the shell's header: "โหมด Demo · ข้อมูลจะถูกลบใน n ชั่วโมง" (hours left,
    from the user's `createdAt`).
11. **Size cap**: a demo user's push is refused past **2,000 own rows** (seed included), as a
    rejected op with `DEMO_LIMIT`, so a demo can't be used to store anything.
12. Account's ออกจากระบบ becomes **จบ Demo**: it asks once ("ข้อมูล Demo จะถูกลบทันที"), then
    `DELETE /auth/demo` deletes the user at once (as the account deletion of privacy.md rule
    8, no mail, no recent auth), the device wipes and goes to sign-in. Nothing is pushed first:
    it all goes. A caller that isn't a demo gets `403 NOT_DEMO`.

**Expiry**

13. The daily auth cleanup cron (auth.md rule 20) deletes demo users created more than **24 hours**
    ago, with everything under them (`onDelete: 'cascade'`).
14. A device still holding a deleted demo: its next refresh is refused like a revoked session,
    the app wipes the local data (offline-sync rule 7) and the sign-in page says "Demo
    หมดเวลาแล้ว" with a link to `/auth/demo`. The server only knows the session is gone
    (`SESSION_EXPIRED`), so the device remembers it holds a demo (`tpn-demo` in localStorage,
    set whenever a demo user is signed in) and treats that refusal as revoked.

## Endpoints

| Method | Path              | Auth   | What                                                         |
| ------ | ----------------- | ------ | ------------------------------------------------------------ |
| POST   | `/auth/demo`      | —      | `{ botToken, lang }`; creates the demo user and seed (rule 4) |
| DELETE | `/auth/demo`      | Bearer | จบ Demo: deletes the caller, a demo user only (rule 12)       |
| GET    | `/auth/providers` | —      | Gains `demo` (rule 1)                                        |

Error codes: `DEMO_DISABLED` (404, checked before the bot check), `DEMO_NOT_ALLOWED` (403),
`NOT_DEMO` (403, `DELETE /auth/demo` from a real account), `DEMO_LIMIT` (a rejected op),
`BOT_CHECK_FAILED`, `RATE_LIMITED`. `AuthUser` gains `isDemo` and `createdAt`; the cleanup's
answer gains `demoUsers`.

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

## The seed (Q1)

The template lives in `api/src/features/auth/auth.demo-seed.ts` (agreed with the owner
2026-11-17). An office worker in Bangkok earning ฿35,000 (฿34,250 after social security), in
the request's language. **D** is the day the demo starts; the data covers the days after "the
same date 3 months ago" up to D, so each monthly row comes 3 times. Everyday rows follow the
real day of the week, their amounts cycling by `k mod 4` (k = days before D); none while away
on the trip (D-40 to D-35). A note is left empty where the category already says it (owner).
About 420 rows in all (405–420 by the start day); the bank never goes below 0 for any start
day of the year.

- **Book** ส่วนตัว / Personal, with the default categories (category rule 8).
- **Wallets**: เงินสด ฿2,500 · บัญชีธนาคาร ฿80,000 · บัตรเครดิต −฿6,800 (a card, out of the
  total) · เงินออม ฿60,000 (out of the total) · เงินเยน ¥0 (JPY).
- **Monthly**: rent ฿7,500 on the 1st (a rule, recorded by itself; its next occurrence is the
  first after D) · home internet ฿599 on the 3rd · phone plan ฿499 on the 5th (both
  อินเทอร์เน็ต) · gym ฿990 on the 8th (card) · electricity ฿1,150 / 1,380 / 1,240 and water
  ฿165 / 190 / 180 on the 10th · money for Mom ฿3,000 on the 20th · salary ฿34,250 on the 25th
  · saving ฿5,000 to เงินออม on the 26th · a streaming subscription ฿419 on D's day of the
  month (card, a rule that **asks first**: two recorded, D's due).
- **Everyday**: drinks (cash) and lunch (อาหารประจำวัน) Monday–Friday, the metro to work and
  back ฿74, dinner Monday–Thursday, a convenience store Tuesday and Thursday, dinner with friends
  on Friday and groceries on Saturday (card, the parent category), a taxi every other Saturday,
  brunch on Sunday, a film or clothes some Sundays, ฿1,500 cash from the bank on Mondays.
- **Dated**: card payments from the bank on D-78 / D-48 / D-18 (฿6,800 / 31,500 / 7,200), an
  online course, flights and a hotel for the trip, a pharmacy, travel insurance, the airport
  taxis, a haircut, a friend's gift, old headphones sold.
- **The yen**: on D-42 an expense of ฿13,500 from the bank and an income of ¥60,000 into the
  yen wallet, both **out of the reports** and not on the trip, so the trip counts once.
- **Trip** ทริปญี่ปุ่น / Japan trip, D-40 to D-35, closed: 15 yen rows (trains, ramen, sushi,
  a theme park, kimono, souvenirs, …) and the THB flights, hotel, insurance and taxis.
- **Debt**: lent ฿5,000 to เพื่อนร่วมงาน / Coworker on D-50 ("ค่ามัดจำห้อง"), ฿2,000 back on
  D-20, due D+30.

## Decisions

- Q1 (owner, 2026-11-17): the seed's exact rows (names, amounts, which days) are a template in
  the API, drafted and reviewed with the owner before the API is built (above).
- Q2 (owner, 2026-11-17): the banner can't be closed; it is one thin line.
