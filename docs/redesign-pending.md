# Redesign: what still needs your attention

Updated 2026-09-20, after Phase 2b. The reasoning behind each item is in `design-system/bookly/MASTER.md`, section 9. This file is the checklist; tick items off as they are done.

## 1. Before Phase 3 section 5 (I will stop and tell you)

Your answers to decisions 6, 7 and 8: build these first. They are feature work (new pages, new copy, changes to logic files), so they do not belong in the visual-only redesign. Each page then gets a design file in `design-system/bookly/pages/` and joins Section 5.

- [ ] **Working hours** (weekly hours and dated open/close overrides). Backend: `/api/admin/working-hours`. No page exists. The seeded Mon-Fri 09:00-17:00 cannot be changed without it.
- [ ] **Availability blocks**, with the overlap warning. Backend: `/api/admin/blocks`. The calendar also gains "create a block".
- [ ] **Settings** (booking-fee rate, minimum notice, hold, buffer, delivery days). Backend: `/api/admin/settings`.
- [ ] **Password reset page** at `/admin/reset-password`, plus a "Forgot password" link on the login page. The reset email already links to that address; today it shows "Page not found".
- [ ] **Calendar click-through:** a booking event opens `/admin/bookings/:id`. Today only the bookings list does. Changes `AdminCalendar.tsx` and `calendar-events.ts`.
- [ ] **Decide the final admin nav.** The audit assumed five links (calendar, bookings, catalogue, availability, settings). Say whether working hours and blocks share one page.

**Branch note.** Some of this touches files the redesign treats as protected (`admin/calendar-events.ts`, `admin/api.ts`, `en.json`). Build it on `main` (or on a branch off it), merge it, then merge `main` into `redesign/visual-only` before Section 5. Otherwise the final check ("no protected file in `git diff main`") fails, and the visual branch stops being visual-only.

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
- The seven booking statuses share one look, first used in Section 4 (`MASTER.md` section 7).
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
- [ ] The Section 4 milestone needs the booking funnel run end to end (backend and database running, or mocked), plus `npm run test:e2e`.
- [ ] Before merging `redesign/visual-only`: `PRODUCT.md` and this file sit outside the plan's normally allowed paths (keep or move them). The plan's protected-file check already allows additive `en.json` keys.
