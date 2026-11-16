# Live sync

> Status: **Built** (#20). API: `src/core/live/` (providers, publisher) and
> `src/features/live/` (routes); who may hear a book in `src/core/database/live-access.ts`;
> web: `core/live/`. Builds on [offline-sync.md](offline-sync.md)
> rules 9–11 and [sharing.md](sharing.md) rules 9–11.

## Purpose

When one device saves, the others that are open see it **within seconds** instead of on the next
timed round (5 minutes for own data, 1 minute for a shared book). Example: on a trip, the owner
and an editor share the book "กองกลาง"; one adds an expense, and the other's list shows it
almost at once. The same works between one user's own phone and computer.

The server sends a **poke**, never data: a tiny "something changed" message that makes the device
run the round it already knows (pull, or reading the shared book again). The data still comes
only through `/sync/pull` and `/sharing/with-me/:id/rows`, with their access checks, conflict
rules and cursors. A lost poke costs nothing: the timed rounds still run and catch up.

## Out of scope

- **Sending data** over the live channel. Amounts, names and notes never leave our API through it.
- **Decided against** (owner, 2026-11: a personal, offline-first app that shows nothing as a
  notification today, and new data in a share needs no alert):
  - notifications the user sees (Web Push, "แม่เพิ่มรายจ่าย 500 บาท");
  - waking a **closed** app: live sync works only while the app is open;
  - presence ("who is online") and typing indicators.
    Who did what in a share is [shared-activity.md](shared-activity.md) (#21) instead.
- Live updates of sharing itself (an invite arriving, a member removed, a role changed): backlog
  (ROADMAP). It would reuse the `user:` channel; until then they keep their current triggers
  ([sharing.md](sharing.md) rules 6–7).

## Providers

Chosen with `LIVE_PROVIDER` in the API's env (same pattern as `EMAIL_PROVIDER`, [env.md](../env.md)):

| Value      | Where                                               | How the device listens                                        |
| ---------- | --------------------------------------------------- | ------------------------------------------------------------- |
| `disabled` | default; any environment                            | It doesn't: timed rounds only (today's behaviour)             |
| `local`    | dev and Docker: the API is one long-running process | A stream from our API (`GET /live/events`, rule 9)            |
| `ably`     | staging and production (Vercel, serverless)         | Ably Realtime (free plan), with a token from our API (rule 8) |

- `ably` needs `ABLY_API_KEY`; the API refuses to start without it. Each environment uses its
  **own Ably app and key** (staging's never reaches production).
- `local` keeps its listeners in the API's memory, so it works only with **one** API instance.
  On Vercel it would reach nobody; use `ably` there.
- Specs use an in-memory fake of the port, like the notifier's.

## Business rules

**Channels**

1. Two kinds of channel, named by ids only:
   - `user:<userId>`: the user's own devices. Poked when that user's own rows change.
   - `book:<bookId>`: devices **viewing that book as a member** (a shared book in
     use). Poked when rows of a shared wallet of that book change.
2. A device may only **listen**, never publish. Only the API publishes.
3. Who may listen: `user:<id>` = that user; `book:<id>` = the book's owner and every
   member (editor or viewer) of at least one live, shared wallet of it ([sharing.md](sharing.md)
   rules 7–8).

**The poke**

4. A poke carries exactly `{ seq, deviceId }`: `seq` = the highest `changeSeq` the push stamped,
   `deviceId` = the device that pushed. Nothing else: no table, row id, amount or name.
5. A device ignores a poke from its **own** `deviceId`, and one whose `seq` is not newer than what
   it already has (its pull cursor; for a shared book, the book's read cursor).

**Publishing (API)**

6. After `POST /sync/push`, when **at least one op is `applied`** (`overridden` and `rejected`
   change nothing on the server), the API publishes **once per channel** for that request:
   - `user:<owner>` for every owner whose rows were applied: the pusher, or the book's owner
     when an editor pushed (sharing rule 12 stores the row as the owner's);
   - `book:<bookId>` for each book whose **shared** wallets had a transaction applied.
7. Publishing never fails the push. It runs after the ops are committed, with a short timeout
   (1 s). An error or a timeout is logged as a warning and the push still answers as usual. On
   Vercel the publish is awaited before the response, because the function may freeze after it.

**Listening (web)**

8. With `ably`, the device asks `POST /live/token` for an Ably token whose rights are
   **subscribe only**, on its `user:` channel and the `book:` channels it may listen to at that
   moment (rule 3). The token lasts **1 hour**, and Ably's SDK asks for a new one by itself.
   Losing membership therefore stops the pokes within the hour. Until then a former member may
   only learn _that_ something changed; reading it is refused as today (`404`, sharing rule 8).
9. With `local`, the device reads `GET /live/events`, a server-sent event stream behind
   `authenticate`, through `fetch` with the usual `Authorization` header (never a token in the
   URL). The API checks rule 3 when the stream opens and on each poke.
10. The device listens while it is **signed in, online, the local database is open and the app is
    in the foreground**. It stops when the app goes to the background, offline, locked or signed
    out, and starts again when that ends; coming back already runs a round (offline-sync rule 11).
    It listens to `book:<id>` only while that shared book is in use.
11. On a poke the device waits **300 ms** (pokes in that time count as one), then:
    - `user:` → a normal sync round (`SyncService.sync()`), under the same Web Lock;
    - `book:` → reading the shared book's changes (`SharingService.refreshShared()`).
      A round already running takes the poke as "run once more" (as a write during a round does).
12. The timed rounds stay as they are (5 min own, 1 min shared). Live sync only adds triggers; a
    device whose live connection drops loses nothing but speed.
13. A failed token request or connection is quiet: no toast, no pill change. Retries follow the
    SDK's own back-off (`ably`) or rule 11's delays of offline-sync (`local`). It shows in the
    sync sheet only (Web screens).

## Endpoints

| Method | Path           | Auth           | What                                                                                        |
| ------ | -------------- | -------------- | ------------------------------------------------------------------------------------------- |
| POST   | `/live/token`  | `authenticate` | `{ provider: 'ably', tokenRequest }`, `{ provider: 'local' }` or `{ provider: 'disabled' }` |
| GET    | `/live/events` | `authenticate` | `local` only (else `404`): an SSE stream of `poke` events `{ channel, seq, deviceId }`      |

`/sync/push` gains no field: the API reads `deviceId` from the push body it already gets.

## Data model

None. Nothing about live sync is stored: channels are names, pokes are not kept, and the `local`
listeners live in memory.

## Web screens

- No new screen. The sync sheet adds one muted line under the last sync time:
  "อัปเดตทันที: เชื่อมต่อแล้ว" / "อัปเดตทันที: ไม่ได้เชื่อมต่อ" (hidden with `disabled`).
- Nothing else changes on screen: the list just updates, as it does after a timed round.

## Interactions

- **Sync** (API `features/sync`): the push service hands the applied rows' owners, books and
  highest `changeSeq` to the live port (rule 6). It never imports a provider.
- **Sharing** (API): rule 3's "may listen" uses `@/core/database/wallet-access`, like the push.
- **Web** `core/offline` `SyncService` and `core/sharing` `SharingService` gain one trigger each;
  `core/live` owns the connection and imports neither (they subscribe to it).
- **Cost**: Ably's free plan (6 million messages a month, 200 connections at once). A family
  stays far below it: one poke per push per channel, times the devices listening.

## Decisions (owner, 2026-11, at the start of #20)

1. **Timed rounds while live**: unchanged in this version. Later, a device with a live
   connection could stretch the shared book's 1-minute refresh to 5 minutes (backlog).
2. **The sync sheet line**: shown ("อัปเดตทันที: …"), hidden with `disabled`.
3. **Background tabs**: stop listening (rule 10).

## Built notes

- A poke is published only for ops this request **newly** applied: a retried `opId` (its stored
  result), an `overridden` or `rejected` op, and a delete of a row already deleted poke nobody.
  A transaction moved between wallets pokes the shared book of both.
- `local`: the stream carries every channel the user may hear (the API checks rule 3 on each
  `book:` poke); the device keeps the channels it listens to. The API ends a stream after
  10 minutes (a comment line every 25 s keeps proxies open) and the device opens a new one at
  once, with a fresh access token, so a signed-out session stops hearing soon after.
- `ably`: the API uses `@ably/pubsub-server` (a server, with the API key: not counted as a
  monthly active user) and the web `@ably/pubsub-device` (a device). The old `ably` package
  (2.x) is refused by an account billed by MAU (Ably error 40168). A device connection on such an
  account must carry a client ID, so the token request sets `clientId` to the user's id.
- `ably`: the token request lists `user:<id>` and the books of rule 3 at that moment. A
  book shared after the token was made fails to attach; the device then asks for a new token
  and attaches again.
