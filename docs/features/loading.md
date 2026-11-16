# Loading (splash, first pull, page progress)

> Status: **Building** on `feat/web-loading` (web only, no API change). Mock-up:
> [`mockups/loading.html`](mockups/loading.html). Decided with the owner on 2026-11-15.

## Purpose

Opening the app used to show a blank screen until three things finished: the JavaScript loaded,
`/auth/refresh` answered (slow when the server starts cold) and the local database opened. It
looked frozen. This feature shows the app at once and says what it waits for, without slowing
anything that is already fast.

## Out of scope

- Preloading the lazy pages after the first one. The service worker (`ngsw-config.json`) already
  caches every chunk once it is installed, so a page is slow only in a device's first session.
  Measure on staging first; add a preloading strategy later only if that first session still
  feels slow (owner, 2026-11-15).
- A bar for background sync: the data on the device is already on screen, and the header's sync
  icon says a round is running.
- Spinners for local reads (DESIGN.md §6 Loading: they are instant).

## Rules

1. **Splash** (`index.html`, plain HTML and CSS, no Angular): the app icon and "ตังค์ไปไหน" on the
   theme's background (the existing theme script picks light / dark and the palette), shown from
   the first paint until the **first navigation ends** (a page, sign-in, the lock screen or "open
   in another tab"), then faded out (150 ms) and removed from the page.
2. After **1 s** the splash adds a bar under the name and one line on what it waits for:
   - `app`: กำลังโหลดแอป / Loading the app (until Angular starts the first navigation);
   - `auth`: กำลังตรวจสอบการเข้าสู่ระบบ / Checking your sign-in (the shell guard's
     `/auth/refresh`);
   - `data`: กำลังเปิดข้อมูลในเครื่อง / Opening your data (opening or making the local
     database).

   The words live in `index.html` in both languages (Angular's translations aren't loaded yet);
   Angular only sets the step.

3. After **10 s**: "การเชื่อมต่อใช้เวลานานกว่าปกติ / กรุณารอสักครู่ หรือลองใหม่อีกครั้ง" (This is
   taking longer than usual. / Please wait, or try again.) and a **ลองใหม่** / **Try again**
   button that reloads the page.
4. **First pull on a new device** (the shell's `loading` gate): a device that has never finished a
   round shows one loader in the middle of the book tabs **until that round ends** (every page
   pulled, or the round failed), so the first numbers seen are the whole ones and don't move as
   later pages arrive (owner, 2026-11-15; `BookService.firstPull`). No other bar: an icon,
   "กำลังโหลดข้อมูลของคุณ" / "Loading your data" and, once rows arrive, "ได้รับแล้ว n รายการ" /
   "n items received" (rows pulled in the running round, `SyncService.pulledRows`). A device that
   can't sync (offline, untrusted) doesn't wait.
5. **Page progress bar**: a 3 px bar in the brand colour along the top edge while a navigation
   waits (a lazy page's chunk, a guard). Not for the first navigation (the splash covers it).
   - It shows only when the navigation takes over **300 ms**, so fast ones show nothing.
   - It starts at 20 % and creeps toward 90 %, slower the closer it gets, and **holds below
     90 %** while the navigation is still running (the real time can't be known).
   - When the navigation ends it fills to 100 % and fades out.
   - It animates `transform: scaleX()` only (no layout per frame) and isn't in the page while
     idle. With "reduce motion" on it jumps instead of sliding.

## Web

- `index.html`: the splash markup, its CSS and a small script (the 1 s / 10 s timers, the retry
  button). The theme script sets the splash's colours.
- `core/boot`: `BootSplash` sets the step and removes the splash after the first navigation; it
  does nothing when the page has no splash (tests).
- `core/offline/offline.guard.ts` (`shellGuard`) sets `auth`, then `data`.
- `layout/nav-progress.ts` (`app-nav-progress`): the page progress bar, in `App`'s template.
- `layout/app-shell.ts`: the `loading` gate's loader (rule 4).

## Open questions

None. Settled 2026-11-15 (owner, from the mock-up): splash frames 2–4 with wording option ก, one
loader on a new device, no bar for background sync, the creeping bar for page changes, no
preloading for now.
