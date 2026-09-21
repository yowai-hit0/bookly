# Redesign: what still needs your attention

## Run state

Append-only. The newest entry is last. Progress lives here and in git history, never only in a context window.

### Stage 0 — clear the open items (2026-09-21) — DONE

- Pushed `main`, `feature/admin-availability-settings-reset` and `redesign/visual-only` to origin (all were ahead).
- `docs: track the user-journeys write-up` (`0611cf5`) — the file was untracked, so Stage 4's rewrite would have had no reviewable diff.
- `fix: move focus to the cancelled heading after a client cancels` (`5873373`) — `BookingPage.tsx`, plus a Vitest case asserting focus. Gate green: 1269 vitest tests.
- `design:` (this commit) — discovery rule: wrote `pages/{availability,settings,admin-reset-password}.md`, added row 5b to the Phase 3 table.
- **Decision, not in the diff:** the three new page files put availability and settings on the 1.5rem `h1` side of the admin title inconsistency (section 5 below), and set the last two nav icons (`CalendarClock`, `Settings`) that `admin-shell.md` deferred to them.
- **Next action:** Stage 2 — the client shell, landing page and tokenless lookup page. First check the backend for an existing resend / magic-link endpoint; if none exists, stop and report.

---

Updated 2026-09-21, after the Section 5 feature work. The reasoning behind each item is in `design-system/bookly/MASTER.md`, section 9. This file is the checklist; tick items off as they are done.

## 1. Before Phase 3 section 5 -- done (2026-09-21)

Decisions 6, 7 and 8, built as feature work on `main` (commit `d02bd41`) and merged into `redesign/visual-only`. Every endpoint already existed, so none of it touched the backend. Each page still needs a design file in `design-system/bookly/pages/` and joins Section 5.

- [x] **Working hours** (weekly hours and dated open/close overrides). `/admin/availability`.
- [x] **Availability blocks**, with the overlap warning (spec 6.4: named, never silently saved over a confirmed booking). Same page, plus "Block time" on the calendar.
- [x] **Settings** (booking-fee rate, minimum notice, hold, buffer, delivery days). `/admin/settings`.
- [x] **Password reset page** at `/admin/reset-password`, plus "Forgot your password?" on the login page. The token travels in the URL fragment, so it reaches no server log or referrer.
- [x] **Calendar click-through:** a booking event opens `/admin/bookings/:id`. A block opens the availability page that edits it, so every event FullCalendar puts in the tab order leads somewhere.
- [x] **The final admin nav** is five links: calendar, bookings, catalogue, availability, settings. **Your decision, 2026-09-21: working hours and blocks share one Availability page,** because between them they answer one question -- when can a client book?

**Still to design (Section 5 and after).** These shipped wearing the pre-redesign admin styling, which is what Section 5 onward restyles. ~~`availability.md` and `settings.md` do not exist yet; write them before Section 5 applies anything to those two pages.~~ **Done 2026-09-21:** `pages/availability.md`, `pages/settings.md` and `pages/admin-reset-password.md` are written and the Phase 3 table has a row 5b. Section 5 no longer restyles these three pages blind.

**Branch note (settled).** The work touched `en.json` and `index.css`, so it was built on `main` and merged in; `git diff main` on the visual branch is unchanged by it, and the protected-file check still passes.

## 2. Waiting on you or the client

- [ ] **Photographer contact details** (decision 9): phone, WhatsApp and/or email. Three messages tell clients to "contact the photographer" (`checkout:closed.body`, `booking:delivery.expired`, `booking:cancel.notCancellable`), but no page shows a contact detail. When you have them, choose where they appear. New `en.json` keys are allowed (additive only).
- [ ] **A real landing page for `/`** (decision 4). `/` is an API-status stub for now, only restyled. A landing page needs your wording (hero, call to action). Nothing may be invented: no portfolio, testimonials, photographer name, logo, service names or prices unless supplied.
- [ ] **Brand assets:** a logo and any brand colours the client already has (the current palette was picked by the design tool), the photographer's name, social links.
- [ ] **Real service names, prices and cover images** (spec R-6). Cover images are URLs the admin pastes.
- [ ] **Confirm working hours** with the photographer. Mon-Fri 09:00-17:00 was the developer's choice, and events often fall on weekends (spec R-4).

## 3. Decided; done during Phase 3 (nothing needed from you)

- NotFound gets an "All services" link, reusing the existing string `services:allServices`.
- Home is restyled only.
- The admin shell gets a skip-to-content link (a new `en.json` key, additive).
- The seven booking statuses share one look, first used in Section 4 (`MASTER.md` section 7). Built: the client pill uses the shared `StatusBadge`. Still to adopt it: the calendar events (Section 6) and the admin badges (Section 7).
- The admin sidebar reflows to a top bar below 1024px. No drawer, no collapse toggle.

## 4. Product gaps outside the redesign (from `PRODUCT.md`)

- Airtel Money and card payments (via Flutterwave) are planned, not built. Only MTN MoMo is live.
- The one-way push of confirmed bookings to Google Calendar is planned, not built.
- SMS / WhatsApp notifications are undecided (the client said "both would be ideal"; the brief lists them out of scope).
- French: the client wants English and French; English only at launch.
- Privacy notice and erasure routine: specified, not built.
- If the photographer cancels, the fee is owed back in full. That is a developer-proposed default (spec A-5), not confirmed.
- The positioning statement in `PRODUCT.md` is inferred, not confirmed.

## 5. Redesign housekeeping

- [x] Impeccable: the engine (0.1.5) is installed and its checksum matches the release; its design hooks are switched back on (2026-09-20). Nothing to install.
- [x] Checked 2026-09-20: Impeccable's overused-font rule does not flag Poppins or Open Sans (it does flag Geist, which the redesign replaced).
- [ ] Dark mode is not designed (`.dark` is unreachable). Say so if you want it.
- [x] The Section 4 milestone: the whole client journey clicked through by script with `/api` mocked, at 1280px and 375px touch, plus `npm run test:e2e` (2026-09-20; the record is in `MASTER.md` section 11). **Still yours:** the same click-through once against the real backend and database.
- [x] **After cancelling, keyboard focus falls to the page body and nothing announces the change** (the booking page, `BookingPage.tsx`). Fixed 2026-09-21 (`5873373`): focus moves to the heading of the section that replaces the cancel button, which is also what announces the outcome. A Vitest case asserts it. Committed as `fix:` on its own, so it reverts without touching any visual work.
- [ ] Before merging `redesign/visual-only`: `PRODUCT.md`, `DESIGN.md`, `.impeccable/design.json`, this file and three e2e specs (`frontend/e2e/{booking,services,slot-picker}.spec.ts`, one locator each, renamed because the back link's accessible name lost its arrow character) sit outside the plan's normally allowed paths (keep or move them). The plan's protected-file check already allows additive `en.json` keys.
- [ ] `DESIGN.md` and its sidecar were written after Section 1 and hand-updated after Sections 2, 3 and 4 (2026-09-20). Re-run `/impeccable document` at the Section 4 milestone and in Phase 4 so they describe what has shipped by then.
- [ ] **Four** admin pages title at 1.25rem while the others use 1.5rem: calendar and catalogue (Sections 6 and 8), and availability and settings (added 2026-09-21, restyled with Section 5). The new page files put availability and settings on the 1.5rem side; calendar and catalogue are still open. Fieldset legends now use the heading font, fixed in Section 2.
- [x] **The `outline` Button variant was nearly invisible on the page.** Decided 2026-09-20, at Section 3: fix the variant itself. It is now `border-input bg-card` (a slate edge on white, 3.27:1), so every outline button improved at once, and the local overrides from Section 2 were removed. The admin's outline buttons changed slightly ahead of their own sections.
- [ ] On a 900px-tall desktop the service page's 21:9 cover image (about 425px at full width) puts the first package right at the fold. A `max-h` on the cover would bring the first step up. It is a page-file decision, so it stays as designed until you say.
