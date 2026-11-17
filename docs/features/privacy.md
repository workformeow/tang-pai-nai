# Privacy notice and account deletion

> Status: **Built** (#22). API: `src/features/auth/` (`DELETE /auth/account`,
> `GET /auth/account/deletion`, `TEST_VERSION`); web: `features/account` (`privacy-page`,
> `delete-page`, the Account and Security rows), `features/auth` (`/auth/privacy`, the sign-in
> lines). Builds on [auth.md](auth.md) rule 13 (recent
> authentication) and [sharing.md](sharing.md).

## Purpose

Friends outside the family are about to try the app on staging, so it stores their email and their
money data. Before that, every user must be able to read **what is kept and where**, see that it is
a **test version**, and **delete their account** with all its data themselves. This is the
minimum the backlog's "open sign-up obligations" (PDPA) asked for.

## Out of scope

- A legal terms-of-service document, cookie banner or consent checkbox. The notice informs
  (PDPA section 23); the data is kept to provide the service (contract basis), not on consent,
  so nothing asks the user to accept it (rule 3). The app sets no tracking cookies (only the
  sign-in cookie).
- A waiting period or undo for a deletion (owner, 2026-11: delete at once, with several
  confirmations instead, rule 7).
- Exporting your data before deleting: CSV export already exists (Account › ส่งออก CSV); the
  delete page links to it.
- Deleting one book's data only: that is deleting the book (book.md).
- Removing data from the providers' own backups and logs (Turso, Vercel, Resend). They expire on
  the providers' schedules; the notice says so (without the names).

## Business rules

**The notice**

1. One page, **ประกาศความเป็นส่วนตัว** (`/auth/privacy`), open **without signing in**, in Thai and
   English like every screen. It says, in plain words:
   - what is kept: email, display name, password hash (if set), sign-in sessions (device and
     browser name, IP at sign-in), and the user's own data (books, wallets, categories,
     transactions, transfers, debts, events, recurring rules);
   - where: the servers of our cloud providers, with a bot check at sign-in (named by kind, not
     by vendor: the notice prints no Turso, Vercel, Resend or Turnstile, owner 2026-11); a copy
     of the user's data is kept **encrypted on each signed-in device** (offline-sync rule 4);
   - who sees it: only the user, and the people they share wallets with (sharing.md); never sold
     or given to anyone else; no ads or analytics;
   - how to delete it: Account › ความปลอดภัย › ลบบัญชี (rule 5), which also wipes this device;
     the providers' backups and logs expire on their own; ทดลองใช้ Demo keeps no personal data
     (no email or phone) and a demo account goes with all its data within 24 hours
     ([demo.md](demo.md), #25);
   - while it is a test version: rule 2's sentence.
     No personal contact address is printed: deleting in the app needs nobody's help.
2. **Test version**: while the API's `TEST_VERSION=true` (staging; `false` or unset in
   production), `GET /auth/providers` answers `testVersion: true` and the app shows
   "เวอร์ชันทดสอบ · อาจล้างข้อมูลหรือปิดปรับปรุงโดยไม่แจ้งล่วงหน้า" on the notice page and as one
   muted line on the sign-in page.
3. The sign-in page shows, under its forms, "รายละเอียดการเก็บและใช้ข้อมูล:
   [ประกาศความเป็นส่วนตัว]" (a link to rule 1's page; no "signing in means you accept" line,
   owner 2026-11). Account › เกี่ยวกับ (or the last group of the Account tab) has a row to the same
   page, its hint the same words.

**Deleting the account**

4. Deletion needs the network and a live session; offline the page says it needs the internet.
5. The page **ลบบัญชี** (Account › ความปลอดภัย, the last row, in destructive red) shows, before
   anything can be pressed:
   - what goes: every book, wallet and transaction of the account, on every device, and that
     it **can't be undone**;
   - a link to ส่งออก CSV to keep a copy first;
   - when the user **owns shared wallets**: "กระเป๋าที่แชร์อยู่กับ N คนจะหายไปจากพวกเขาด้วย"
     (N from rule 10's summary);
   - when the device has unsent changes: they are lost too (the count, as at sign-out).
6. **Three confirmations**, in order (owner, 2026-11):
   1. **Recent authentication** as in auth.md rule 13: within 10 minutes of a sign-in, else the
      current password or a step-up code (the existing `REAUTH_REQUIRED` step);
   2. **typing the account's email** into a field; the button stays off until it matches
      (trimmed, case-insensitive);
   3. the button **"ลบบัญชีถาวร"** (destructive).
7. The deletion happens **at once**: no waiting period and no undo.
8. On the server, in one transaction: the `users` row is deleted, and every table that
   references it goes with it (`onDelete: 'cascade'`: sessions, identities, OTPs, books and
   everything under them, outbox records, change history, invites, memberships). Two kinds of
   rows hold the **email in plain text without a `userId`**, so the same transaction deletes
   them by address: sign-in codes (`otp_challenges` with that `destination`) and invites
   **addressed to** that email by other owners (`wallet_invites.email`). The API checks the typed
   email again (`422 ACCOUNT_EMAIL_MISMATCH` when it differs) and the recent authentication
   (`403 REAUTH_REQUIRED`).
   - What may stay, and why it isn't personal data: rate-limit counters keyed by a **SHA-256 of**
     the email or IP (they expire within a day); the user's random id in `addedBy` /
     `updatedBy` / `change_history` of **other owners'** rows (rule 14; the name is gone with
     the user).
9. After it commits, the API mails the address once: "บัญชีของคุณถูกลบแล้ว" (in the request's
   `lang`, no link). The mail counts toward `EMAIL_DAILY_LIMIT`; a failed send is logged and
   doesn't undo anything.
10. `GET /auth/account/deletion` answers the summary rule 5 shows: how many people the user's
    shared wallets reach (members of their books, counted once each).

**After deleting**

11. **This device**: the app wipes the local database (`OfflineService.wipe()`, without pushing
    the outbox) and goes to sign-in, which shows "ลบบัญชีแล้ว".
12. **The user's other devices**: their sessions are gone, so the next refresh is refused like a
    revoked session and they wipe (offline-sync rule 7). A device that stays offline keeps its
    encrypted copy until it next goes online.
13. **People the user shared with**: the owner's shared book is gone; their next read answers
    `404` and the app goes back to their own book (sharing rules 8 and 10).
14. **Owners the user was a member of**: rows the user added stay the owner's; `addedBy` /
    `updatedBy` keep the old id and read as **"สมาชิก"** (sharing rule 15).
15. Signing in again later with the same email creates a **new, empty** account.

## Endpoints

| Method | Path                     | Auth   | What                                                         |
| ------ | ------------------------ | ------ | ------------------------------------------------------------ |
| GET    | `/auth/account/deletion` | Bearer | Rule 10's summary `{ sharedWith }`                           |
| DELETE | `/auth/account`          | Bearer | `{ email, lang }`; recent auth (rule 6); deletes (rules 8–9) |
| GET    | `/auth/providers`        | —      | Gains `testVersion` (rule 2)                                 |

Error codes: `ACCOUNT_EMAIL_MISMATCH` (422), `REAUTH_REQUIRED` (403).

## Web screens

- `/auth/privacy`: the notice, in the sign-in layout (like `/auth/install`), with ‹ back.
- Sign-in page: the test-version line (rule 2) and the notice line (rule 3) under the forms.
- Account › ความปลอดภัย › ลบบัญชี (`/account/delete`): rule 5's text, the confirm step
  (`ReauthFlow`), the email field (`app-input-field`, `type="email"`), the destructive button.
  After success: wipe and sign-in with "ลบบัญชีแล้ว".
- Account tab: a row to the notice (rule 3).

## Interactions

- **Auth**: recent authentication and the reauth step (rule 13), the mail sender and its limits,
  sessions (their rows go with the user).
- **Sharing**: rule 10 counts members of the user's books; rules 13–14 rely on sharing's
  existing `404` and "สมาชิก" behaviour.
- **Offline** (web): `OfflineService.wipe()`, and the revoked-session path for other devices.
- **Env**: `TEST_VERSION` in [docs/env.md](../env.md) (staging `true`).

## Open questions

- None. Decided with the owner (2026-11): notice + test line + sign-in line, deletion in the app,
  at once, three confirmations (recent auth, typed email, button), owners warned about members,
  members' rows stay the owner's as "สมาชิก".
