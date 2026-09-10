# Bookly — Implementation Plan

| | |
|---|---|
| **Builds** | `specs_v2.md` (behaviour) on `data-model_v2.md` (storage) |
| **Tasks** | 25, sequential. Each is one focused work session. |
| **Frontend** | React + TypeScript via Vite · shadcn/ui · Tailwind for custom styling |
| **Backend** | Express + Prisma · TypeScript · PostgreSQL 15+ (local instance) |
| **Layout** | `backend/` · `frontend/` · `docs/` — two independent projects, no monorepo tooling |
| **Launch blocker outside this plan** | **R-6** — no service names, prices, durations, photo counts or images exist yet. Tasks 1–25 can all complete without them; the site cannot go live without them. |

## How to read a task

Every task carries **Goal**, **Dependencies**, **Verification**, and **Assumptions** where the spec is silent. A task is done when its verification passes, not when the code is written.

File paths are deliberately absent. They churn as the project evolves and would be the first thing to go stale and cause merge conflicts; the Goal says what the task owns and the Verification says how you know it landed.



## Global definition of done

Applies to every task; not repeated below.

- `npm run lint`, `npm run typecheck`, `npm test` pass in **both** `backend/` and `frontend/`.
- No user-facing string is hardcoded in a component — every one resolves through i18next (spec §7).
- Every new Express route enforces its permission from spec §2.2 in middleware, and a test asserts the denial case, not only the allow case.
- No money is computed anywhere except at write time per `data-model_v2.md` §9.5, or read from the `booking_totals` view.
- Any schema change goes through `prisma migrate dev --create-only` + hand-edited SQL. **`prisma db push` is never run** — it would drop the exclusion constraint (`data-model_v2.md` §2.1).

## Stack decisions (override before Task 1 if you disagree)

| Choice | Decision | Why |
|---|---|---|
| Migrations | Prisma migrations, SQL hand-edited before applying | The exclusion constraint, partial indexes, CHECKs and the view are not expressible in Prisma's DSL |
| Reading `booking_totals` | `prisma.$queryRaw` with a hand-written row type | Avoids Prisma's `views` preview feature |
| Admin session | Signed `HttpOnly` cookie (JWT, 8 h) + `admin_user.session_epoch` for global revocation | One admin. A session table would be a 14th table to invalidate one user's cookies |
| Auth transport | App and API on one registrable domain, `SameSite=Lax`, CORS with credentials for exactly the web origin, CSRF token on every state-changing request | Cookie-authenticated APIs have no implicit cross-origin protection |
| Tests | Vitest against the local PostgreSQL instance · Playwright for E2E | The critical logic is database behaviour; mocking the database would test nothing |
| Background work | `node-cron` inside the API process, claiming rows with `FOR UPDATE SKIP LOCKED` | Safe to run on multiple instances without a distributed lock |
| Email provider | Resend behind a `MailProvider` interface | Not named in the spec. Swappable in one file |
| Blob storage | Managed blob store for **service cover images only**, ≤2 MB | Spec §4.2 excludes built-in photo *delivery* hosting; marketing images are a different thing |
| Shared code | **None.** No workspace package. The zod schemas, the quote function and the formatters exist twice — once per project | Chosen deliberately (no monorepo tooling). Contained by making the **server authoritative**: it recomputes every amount and revalidates every payload, and a fixture file at `docs/fixtures/` is asserted by both test suites so a divergence fails a test rather than reaching a client |
| Public page rendering | **R-7 is open.** Build assuming prerendering (option A) — Task 11 verifies it | A pure SPA renders nothing until its bundle fetches, which fights the LCP target and search indexing |

---

## Task 1 — Workspace scaffold and tooling

**Goal.** Stand up the two apps, the shared package, the toolchain and local Postgres, so every later task has somewhere to land and a way to be tested.

**Dependencies.** None.

**Verification.**
- `npm run dev` starts Vite on 5173 and Express on 4000 concurrently; `GET http://localhost:4000/health` returns `{"ok":true}` and the Vite page returns 200.
- `backend/` and `frontend/` each install, lint, typecheck and test independently — neither has a dependency on the other's build.
- `npx shadcn@latest add button` installs into `frontend/src/components/ui` and the button renders.
- Both `env.ts` files validate required variables at boot with zod: removing `DATABASE_URL` makes the API exit with a named error, not a later runtime crash.
- CORS is configured from `WEB_ORIGIN`: a request from an unlisted origin is refused.

**Assumptions.** `PAYMENT_PROVIDER` is an environment variable on the API, never a database row (`data-model_v2.md` §5.2). Added to `.env.example` now as `mtn_momo_direct`.

---

## Task 2 — i18n, routing, and Kigali/RWF formatting

**Goal.** Put the i18n and formatting foundation in before any page exists, so French later is a content drop rather than a refactor (spec §7, A-14), and so no time or amount is ever rendered by ad-hoc code.

**Dependencies.** Task 1.

**Verification.**
- `/` redirects to `/en`; every route is mounted under `/:locale`.
- `/fr/...` renders a not-found page while `fr` is absent from the enabled-locales list; adding `'fr'` to that list makes it render without touching any component.
- Unit tests: `formatDateTime('2026-07-01T06:00:00Z')` returns `1 Jul 2026, 08:00` (Kigali, UTC+2, spec §6.5); `formatMoney(45000)` returns `45,000 RWF`; `formatMoney(45000.5)` throws — money is integer RWF only.
- The frontend and backend each hold a copy of the formatters, and both test suites assert against the **same** fixture file in `docs/fixtures/format.json` — a divergence between the two copies fails a test in both projects.
- A test asserts every key referenced by `t()` exists in `en.json`.

---

## Task 3 — Prisma schema and constraint migration

**Goal.** Create all 13 tables in `schema.prisma`, then hand-write the migration SQL for every guarantee Prisma cannot express — the exclusion constraint above all. This is the task that makes double booking impossible, which is the reason the project exists.

**Dependencies.** Task 1.

**Verification.**
- `npx prisma migrate reset --force` rebuilds from zero and applies cleanly; `npx prisma migrate deploy` on a fresh database produces an identical schema.
- `\dt` lists exactly 13 tables; `\dv` lists `booking_totals`.
- **Constraint existence test:** a query against `pg_constraint` and `pg_indexes` asserts `booking_no_overlap` and all four partial unique indexes exist by name. Prisma cannot report this; the test must.
- **Overlap test:** insert a `confirmed` booking 09:00–10:00 with `buffer_ends_at` 10:30; a second booking 10:00–11:00 fails with SQLSTATE `23P01`; one at 10:30–11:30 succeeds.
- **Buffer release test:** setting the first to `cancelled_by_client` then inserting 10:00–11:00 succeeds.
- **Double-deposit test:** two `payment` rows with `kind='booking_fee'`, `status='succeeded'` on one booking fail with `23505`.
- **Webhook idempotency test:** two `webhook_event` rows sharing `(provider, event_id)` fail with `23505`.
- **Totals test:** a 40,000 package + 10,000 `at_booking` add-on + 5,000 `post_shoot` add-on returns `quoted_total_rwf = 50000`, `grand_total_rwf = 55000` from `booking_totals` via `$queryRaw`.
- A test asserts the exclusion constraint's status list equals the occupying statuses in `data-model_v2.md` §7.1 — the guard against silently freeing occupied time when a status is added later.
- `npx prisma migrate diff` reports no drift after the constraint migration — the hand-written SQL is in migration history, not applied out of band.

---

## Task 4 — Seed data and settings access

**Goal.** Give the system its one admin, its one settings row and its Mon–Fri working hours, plus a typed accessor so no code reads a magic number.

**Dependencies.** Task 3.

**Verification.**
- `npx prisma db seed` creates 1 `admin_user`, 1 `setting`, 5 `working_hours` rows (weekday 1–5, `opens_minute = 540`, `closes_minute = 1020`, `is_open = true`).
- Running the seed twice leaves the same row counts — it is idempotent.
- `getSettings()` returns `{ bookingFeeRate: 0.4, minLeadTimeMinutes: 120, holdMinutes: 30, bufferMinutes: 30, slotGranularityMinutes: 30, deliveryExpiryDays: 90, accessTokenLifetimeDays: 365, inviteLifetimeDays: 14 }`, with `bookingFeeRate` converted from Prisma's `Decimal` at the boundary so no caller ever handles a `Decimal`.
- Inserting a second `setting` row fails on `CHECK (id = 1)`.
- Grep proves no literal `0.4`, `120`, `30`, `90`, `540` or `1020` appears in business logic outside `settings.ts`, the seed, and the migration.

---

## Task 5 — Availability engine

**Goal.** Implement the pure slot-generation function following the five-step resolution order (`data-model_v2.md` §8). Everything a visitor sees on the calendar comes from here, so it is built and tested in isolation before any UI exists.

**Dependencies.** Task 4.

**Verification.** Unit tests with an injected clock, one per rule:
- **Open window:** a Wednesday returns slots; a Saturday returns none.
- **Dated override, additive:** a `working_hours` row with `effective_date` on one Saturday and `is_open = true` returns slots for that Saturday only — the R-4 fix, and it must be proven.
- **Dated override, subtractive:** a row with `effective_date` on a Wednesday and `is_open = false` closes that day while other Wednesdays are unaffected.
- **Block:** a block 11:00–13:00 removes those starts; a multi-day block removes every covered day.
- **Occupancy and buffer:** a confirmed 09:00–10:00 booking makes 10:00 and 10:15 unavailable and 10:30 the first free start.
- **Lead time:** with `now` at 14:00, no start before 16:00 is returned.
- **Fit:** a 120-minute package returns no start after 15:00 on a day closing at 17:00 (`closes_minute = 1020`).
- **Impossible package:** a 600-minute package on an 8-hour day returns zero slots (spec §6.8).
- The function takes rows and a clock as arguments and touches no Prisma client — asserted by it running with no database connection open.

---

## Task 6 — Slot claim transaction and hold sweeper

**Goal.** Implement the transaction that claims a slot, including in-transaction expiry of stale holds, plus the sweeper job. This is the concurrency-correct core of the double-booking fix.

**Dependencies.** Task 5.

**Verification.**
- **Concurrency:** 20 parallel claims on one slot — exactly 1 succeeds, 19 receive a "slot taken" result, and exactly 1 booking row exists for that range.
- **Stale hold:** a `pending_payment` booking with `hold_expires_at` in the past, then a claim on the same slot **without running the sweeper** — the claim succeeds and the stale booking is now `expired` (`data-model_v2.md` §9.2).
- **Live hold:** same test with `hold_expires_at` in the future — the claim fails.
- The claim runs inside `prisma.$transaction` and surfaces `23P01` as a typed "slot taken" result rather than an unhandled Prisma error.
- The sweeper runs on the `node-cron` schedule and is also invocable directly in tests.
- Expiring a hold sends no email — asserted by an empty `outbox` after the sweep (spec §3.2).

---

## Task 7 — Admin authentication and API session layer

**Goal.** Email/password login with optional TOTP, lockout and emailed reset, plus the cookie/CORS/CSRF machinery every later admin endpoint depends on (spec §2.1, §6.23, A-11).

**Dependencies.** Task 4.

**Verification.**
- Correct credentials set a session cookie with `HttpOnly`, `Secure`, `SameSite=Lax` — asserted on the `Set-Cookie` header.
- Wrong password increments `failed_login_count`; past the threshold `locked_until` is set and correct credentials are still refused until it passes.
- With TOTP enabled, a valid password alone creates no session; a valid code completes it; a reused code within its window is rejected.
- Incrementing `admin_user.session_epoch` invalidates an already-issued cookie on the next request — "log out everywhere" without a session table.
- `GET /api/admin/*` unauthenticated returns 401 with no redirect.
- A state-changing request with a valid session cookie but no CSRF token returns 403.
- A cross-origin request from an origin outside `WEB_ORIGIN` is refused by CORS before reaching a handler.
- Password reset stores only a hash; the emailed token works once and is rejected on reuse and after expiry.
- `password_hash`, `totp_secret` and `session_epoch` appear in no API response — asserted by serialising the admin user through the public mapper.

**Assumptions.** Argon2id via `@node-rs/argon2`. Lockout escalates 1 → 5 → 15 minutes; the spec says "rising interval" without values.

---

## Task 8 — Admin availability management

**Goal.** Let the photographer set weekly hours, open or close individual dates, and create blocks — the admin half of the availability engine (spec §3.3, §6.3, §6.4).

**Dependencies.** Tasks 5, 7.

**Verification.**
- Adding a weekday row for Saturday makes every Saturday bookable; deleting it closes them again.
- Adding an `effective_date` row for one Saturday with `is_open = true` opens that date only — verified by querying availability for two consecutive Saturdays.
- A payload with both `weekday` and `effective_date` is rejected by the zod schema with 400, and the database CHECK is proven to reject it too if the schema is bypassed.
- `opens_minute`/`closes_minute` accept `540`/`1020` and reject `1020`/`540` and any value above 1440.
- A full-day block and a 14:00–16:00 partial block remove exactly the expected slots.
- **Conflict warning (spec §6.4):** saving a block overlapping a `confirmed` booking returns 409 naming that booking and requires `confirm: true` to proceed; the booking is **not** cancelled and remains `confirmed`.
- `reason` never appears in the public availability response — asserted against the raw JSON.

---

## Task 9 — Admin calendar views

**Goal.** Month, week and day views of bookings, holds and blocks, so the calendar is the single source of truth he actually looks at (spec §3.3 step 1, brief §4.2).

**Dependencies.** Task 8.

**Verification.**
- A month with 3 confirmed bookings, 1 live hold and 1 block renders 5 distinguishable entities, each labelled with its status.
- Times render in Africa/Kigali regardless of browser timezone — the Playwright test runs with `TZ=America/New_York` and asserts the same displayed time.
- One month issues a bounded number of Prisma queries (asserted with a query-event counter) and the endpoint returns in under 500 ms at p95 against a seeded 500-booking dataset (spec §7).
- A booking overlapping a block renders with a conflict marker (the §6.4 aftermath).
- Built from shadcn primitives; no third-party calendar widget is introduced.

---

## Task 10 — Admin catalogue CMS

**Goal.** Create, edit, reorder, activate and deactivate services, packages and add-ons — everything the photographer sells (spec §3.4, §6.14).

**Dependencies.** Task 7.

**Verification.**
- Creating a service with a package and two add-ons persists and appears on the public list (Task 11 consumes it).
- Editing a package price does **not** change any existing booking's `package_price_rwf` — asserted against a pre-existing booking row.
- Deactivating a service removes it from the public list while its bookings stay readable with their snapshots (spec §6.14).
- Hard-deleting a package referenced by a booking returns 409 and the row survives — Prisma surfaces the FK `RESTRICT` as `P2003`, mapped to 409 rather than a 500.
- **Impossible package warning (spec §6.8):** saving a package whose `duration_minutes` exceeds `max(closes_minute − opens_minute)` across open days returns a warning naming the longest window. Saving is still permitted; the warning is not a block.
- FR name fields exist in the zod schema as optional and are not rendered in the v1 UI.

**Assumptions.** Cover images upload to the blob store with a 2 MB limit; `cover_image_url` stores the resulting URL.

---

## Task 11 — Public service browsing and price summary

**Goal.** The public list and detail pages where a visitor picks a package and add-ons and sees a live total, booking fee and remaining session fee (spec §3.1 steps 1–3, 7).

**Dependencies.** Tasks 2, 10.

**Verification.**
- A 40,000 package plus a 10,000 add-on shows total 50,000 RWF, booking fee 20,000 RWF (40%), session fee 30,000 RWF.
- A service with `booking_fee_rate_override = 0.300` shows 15,000 RWF on the same 50,000 total.
- **The API is authoritative for money.** It recomputes the quote server-side and ignores any total the client sends — a request carrying a tampered total is priced from the catalogue, not from the payload. Both quote implementations are asserted against the same 20-basket fixture in `docs/fixtures/quotes.json`.
- No processing-fee line appears anywhere (spec §3.1 step 7, A-4b).
- The non-refundable notice is present on the summary before any payment control is reachable.
- Only `is_active` services and packages render; a deactivated slug returns not-found.
- **R-7 (prerender):** `npm run build` emits static HTML for `/en` and each service route with the service name present in the HTML source — `curl` the built file and grep for it, with JavaScript never executed. Lighthouse mobile LCP under 2.5 s on service detail.

---

## Task 12 — Public availability calendar and slot picker

**Goal.** Surface the availability engine to visitors: pick a date, see only genuinely bookable starts for the chosen package (spec §3.1 steps 4–5).

**Dependencies.** Tasks 5, 11.

**Verification.**
- `GET /api/availability?packageId=…&month=2026-10` returns only starts satisfying all five rules; a snapshot test pins the response for a fixture month.
- The response contains no block reasons, client names or booking ids — asserted against the raw JSON.
- Selecting a longer package re-queries and returns fewer starts on the same day.
- A slot confirmed between page load and click produces a clear "just taken" state with a refreshed calendar rather than a failed submit (spec §6.1, client half).
- The picker is fully keyboard-operable and passes an axe scan with zero critical violations (spec §7).
- The endpoint is cacheable for a short TTL and the cache is bypassed after any booking confirms — a stale calendar must not outlive a confirmation.

---

## Task 13 — Booking creation

**Goal.** Turn a chosen slot and a filled form into a `pending_payment` booking with a 30-minute hold, all snapshots written and the fee frozen (spec §3.1 steps 6–8, §6.13).

**Dependencies.** Tasks 6, 12.

**Verification.**
- A successful submit creates one `booking` (`pending_payment`), one `client` (or reuses one matched on lowercased email), and `booking_addon` rows with `stage = 'at_booking'`.
- Every snapshot column is populated: `service_name_snapshot`, `package_name_snapshot`, `package_price_rwf`, `package_duration_minutes`, `package_photo_count`, `contact_name`, `contact_email`, `contact_phone`, `booking_fee_rate`, `booking_fee_rwf`.
- Editing the package price afterwards leaves all of them unchanged.
- Changing the client's phone on a later booking does not alter the first booking's `contact_phone` (`data-model_v2.md` fix #9).
- `ends_at = starts_at + package_duration_minutes`; `buffer_ends_at = ends_at + 30 min`.
- `reference` matches `/^BKY-\d{4}-[0-9A-HJKMNP-TV-Z]{5}$/` and a forced collision retries rather than failing.
- The API validates with its own zod schema and trusts nothing from the client; a request bypassing the UI with an out-of-hours or inside-lead-time slot is rejected 422. The frontend's schema is a UX convenience with no authority.
- The consent checkbox is required; omitting it returns 422.

---

## Task 14 — Outbox worker

**Goal.** Build the queue that delivers everything the system sends, with backoff, dedupe and an admin alert on exhaustion. Every later notification depends on it, and it is the only retry mechanism in the system (spec §6.17, `data-model_v2.md` §5.13).

**Dependencies.** Task 3.

**Verification.**
- Enqueuing twice with one `dedupe_key` inserts one row (`P2002` on the second) and the caller treats it as success.
- A throwing handler leaves the row `pending` with `attempts` incremented and `next_attempt_at` pushed out exponentially.
- Past the attempt ceiling the row becomes `failed` **and** an `admin_alert` row is enqueued carrying `last_error`.
- **Atomic claiming:** two worker loops run in parallel against 50 pending rows via `FOR UPDATE SKIP LOCKED` and each row is processed exactly once.
- The queue query uses the partial index — `EXPLAIN` shows an index scan against a table seeded with 100,000 `done` rows.
- The worker starts with the API process and stops cleanly on `SIGTERM` without abandoning a claimed row in `processing`.

---

## Task 15 — Email templates and rendering

**Goal.** Author and wire all ten transactional templates in English through the translation layer, so later tasks enqueue a template name rather than composing copy (spec §4.1).

**Dependencies.** Task 14.

**Verification.**
- All ten render from fixture payloads without error: `booking_confirmation`, `admin_new_booking`, `session_fee_request`, `payment_receipt`, `photo_delivery`, `cancellation`, `reschedule`, `booking_invite`, `access_link_resend`, `admin_alert`.
- Every rendered email shows times in Africa/Kigali and integer RWF, asserted against the same `docs/fixtures/format.json` the frontend uses — snapshot-tested.
- `booking_confirmation` contains the reference, date/time, location, amount paid, amount outstanding and the access link, and contains the raw token nowhere except inside that link.
- Rendering with `locale: 'fr'` falls back to English without throwing.
- A test asserts every `template` value in the `outbox` CHECK constraint has a matching template file.
- Links point at `WEB_ORIGIN`, never at the API host.

---

## Task 16 — Payment adapter and MTN MoMo direct

**Goal.** Define the `PaymentProvider` interface and implement MTN MoMo Collections against the sandbox, generating `our_ref` before the provider is called (spec §4.3, `data-model_v2.md` fix #3).

**Dependencies.** Task 13.

**Verification.**
- Initiating inserts a `payment` row with `status='initiated'`, `provider='mtn_momo_direct'` and a populated `our_ref` **before** any HTTP call — asserted by inspecting the row with the provider client stubbed to throw.
- A provider timeout leaves the row `failed` with `failure_reason` set, the booking still `pending_payment`, and the hold intact.
- `our_ref` is sent as the MTN `X-Reference-Id` header — asserted against the captured request.
- `amount_rwf` equals `booking_fee_rwf` exactly and is never updated afterwards.
- **Method gating (spec §6.19):** with `PAYMENT_PROVIDER=mtn_momo_direct` the pay page offers MTN MoMo only; Airtel and card controls are absent from the DOM, not disabled. The web app reads the available methods from an API capability endpoint rather than hardcoding them.
- A second initiate for a booking with a succeeded booking fee returns 409.

**Assumptions.** MTN sandbox credentials via environment variables. Production MTN access depends on **R-3** and is not required here.

---

## Task 17 — Webhook ingestion and booking confirmation

**Goal.** Accept provider callbacks safely — store first, verify, dedupe, apply forward-only — then confirm the booking, generate the access token and enqueue both emails (spec §3.1 steps 10–11, §6.9, `data-model_v2.md` §7.3).

**Dependencies.** Tasks 15, 16.

**Verification.**
- A valid `succeeded` event moves the booking to `confirmed`, nulls `hold_expires_at`, sets `confirmed_at`, writes `access_token_hash` and `access_token_expires_at`, and enqueues `booking_confirmation` and `admin_new_booking`.
- **Duplicate delivery:** the same `(provider, event_id)` twice yields one `applied` and one `ignored` row, and one `booking_confirmation` outbox row.
- **Out of order:** a `pending` event after a `succeeded` event is stored `ignored` and changes nothing (rank rule, §7.3).
- **Bad signature:** stored with `signature_valid = false`, status `ignored`, nothing applied, 200 returned so the provider stops retrying.
- **Unmatched event:** an event whose `our_ref` matches no payment is stored `ignored` and remains inspectable.
- **Late webhook, slot free (spec §6.9):** a `succeeded` event for an `expired` booking whose slot is still free re-confirms it.
- **Late webhook, slot taken:** leaves the booking `expired`, sets the payment `refund_due`, enqueues an `admin_alert`.
- The webhook route reads the **raw body** for signature verification — a test proves `express.json()` does not consume it first.
- The plaintext access token appears in the outbox payload and in no `booking` column — asserted by a column scan.

---

## Task 18 — Client booking page

**Goal.** The token-addressed page where a client checks status, cancels, pays the session fee and reaches their photos — the whole client-side return experience (spec §3.9, §6.10, §6.21).

**Dependencies.** Task 17.

**Verification.**
- A valid token renders that booking; `access_token_last_used_at` updates.
- An invalid, expired or superseded token renders a generic "link not valid" page and returns 404 — not 403, which would confirm the booking exists.
- Passing another booking's id or reference in any parameter changes nothing — scope comes from the token alone (spec §2.2 enforcement).
- The token travels in the URL path and is never sent to any analytics or error-tracking service — asserted by a scrubbing test on the error reporter.
- **Client cancel (spec §6.10):** confirming sets `cancelled_by_client`, releases the slot (verified by it reappearing in availability), enqueues both cancellation emails, and does **not** refund — the payment stays `succeeded`.
- The non-refundable warning appears in the cancel confirmation.
- A booking with an outstanding session fee shows a payment control; a fully paid one does not.
- Amounts come from `booking_totals`, never recomputed in the browser.

---

## Task 19 — Admin bookings list, detail and lifecycle actions

**Goal.** Everything the photographer does to a booking after it exists: reschedule, cancel with refund flagging, complete, mark no-show, resend the access link, and send a booking link to an offline enquiry (spec §3.6, §3.8, §6.11, §6.12, §6.16, §6.21).

**Dependencies.** Task 18.

**Verification.**
- **Reschedule:** a free slot keeps `id`, `reference`, `access_token_hash` and all payments; writes `original_starts_at` on the **first** move only and `rescheduled_at` on every move; releases the old slot; enqueues `reschedule`. An occupied slot returns 409 from the surfaced `23P01`.
- **Admin cancel (spec §6.11):** sets `cancelled_by_admin`, releases the slot, enqueues `cancellation`, sets the booking-fee payment `refund_due` — the full-refund policy from A-5.
- **Record refund (spec §6.16):** entering a reference moves the payment to `refunded`, sets `refunded_at`, and `collected_rwf` drops accordingly. No provider API is called — asserted by a stub that fails the test if invoked.
- **No-show (spec §6.12):** sets `no_show`, the slot stays occupied (still absent from availability), the booking fee stays `succeeded`, no session fee is owed, no client email is enqueued.
- **Resend access link:** issues a new token, invalidates the old one (old URL now 404s), enqueues `access_link_resend`.
- **Offline booking link (spec §3.8):** sending enqueues `booking_invite` with an HMAC-signed URL; opening it prefills service and package; it is rejected after `invite_lifetime_days`; **no booking and no hold are created by the invite itself**; tampering with any query parameter invalidates the signature.
- The list filters by status and date range and paginates with a stable cursor.

---

## Task 20 — Post-shoot session fee

**Goal.** Complete the shoot, add post-shoot add-ons, request the remaining money and take it (spec §3.5 steps 1–4, §6.15).

**Dependencies.** Task 19.

**Verification.**
- Marking `completed` sets `completed_at` and unlocks the post-shoot add-on editor.
- Adding a 15,000 add-on with `stage='post_shoot'` raises `grand_total_rwf` by 15,000 and `session_fee_rwf` by the same — the v1 under-reporting bug is proven absent.
- "Request session fee" creates a `payment` with `kind='session_fee'` and `amount_rwf` equal to the then-outstanding amount, and enqueues `session_fee_request`.
- **Frozen amount:** adding another add-on after initiation does **not** change that payment's `amount_rwf`.
- **Second request (spec §6.15):** after the first session fee succeeds, adding an add-on and requesting again creates a **second** `session_fee` payment rather than editing the settled one, and both succeed without violating the booking-fee partial unique index.
- Paying enqueues `payment_receipt` and leaves `outstanding_rwf` at 0.

---

## Task 21 — Photo delivery

**Goal.** Attach the external link with its expiry and send the branded delivery email — the last step of the job (spec §3.5 steps 5–7, §6.20, A-7, A-8).

**Dependencies.** Task 20.

**Verification.**
- Saving a link sets `delivery_url` and defaults `delivery_expires_on` to today + 90 days; the admin can override the date.
- A non-https URL is rejected 422 by both the zod schema and the database CHECK.
- "Send photos" enqueues `photo_delivery` containing the link **and the expiry date as text**, and sets `delivery_sent_at`.
- The client page shows the link before expiry and the expired message after — verified by advancing the injected clock past end-of-day Kigali.
- Replacing the link and resending creates a new outbox row with a distinct `dedupe_key`; the previous row is untouched.
- No download-count UI exists anywhere — the hybrid model cannot know it (`data-model_v2.md` §5.9).

---

## Task 22 — Google Calendar one-way push

**Goal.** Mirror confirmed bookings into the photographer's calendar so he sees them on his phone, without letting Google influence availability (spec §3.7, §6.17, A-9).

**Dependencies.** Tasks 14, 19.

**Verification.**
- Confirming enqueues `gcal_create`; processing stores `gcal_event_id` on the booking.
- Rescheduling enqueues `gcal_update` and moves the event; cancelling and no-show enqueue `gcal_delete`.
- The event body carries client name, service, package, location and reference, with times in Africa/Kigali.
- **Failure isolation (spec §6.17):** with the Google client stubbed to fail, the booking still confirms, the client still gets their confirmation email, the outbox row retries then fails, and an `admin_alert` is enqueued carrying the error.
- **No inbound path:** grep proves no code reads Google events; a test asserts availability output is identical with the calendar stub returning a conflicting event.
- Disconnecting leaves bookings unaffected and future pushes are skipped, not failed.

**Assumptions.** The Google refresh token is stored encrypted in API environment configuration, not in the database — one admin, one calendar.

---

## Task 23 — Privacy, consent, erasure and retention

**Goal.** Meet Law N° 058/2021 obligations concretely: the notice, the consent record, the erasure routine and the scheduled purges (spec §7, `data-model_v2.md` §10).

**Dependencies.** Task 21.

**Verification.**
- The privacy page states what is collected, the retention periods, and that photo files live with a third-party host the site cannot delete from.
- **Erasure:** running it on a client with two bookings and three payments anonymises `client`, sets both bookings' `contact_*` and `location_text` to `[erased]`, nulls `special_requests`, `access_token_hash` and `delivery_url`, nulls matching `webhook_event.payload` and `outbox.payload`, and sets `recipient` to `[erased]`.
- After erasure, `booking_totals` returns identical amounts — financial history survives (`data-model_v2.md` §10.3).
- Both access links 404 after erasure.
- **Purges:** the job nulls `webhook_event.payload` older than 12 months, deletes `done`/`failed` outbox rows older than 24 months, and nulls `outbox.payload` older than 90 days. A test seeds rows either side of each boundary and asserts only the older ones change.
- Erasure runs in a single `prisma.$transaction` — a partial erasure is not a possible outcome.

---

## Task 24 — Security, rate limiting, accessibility and observability

**Goal.** Close out the non-functional requirements as testable behaviour rather than intentions (spec §7, §6.22, §2.2 enforcement).

**Dependencies.** Task 23.

**Verification.**
- **Permission matrix coverage:** a table-driven test walks every row of spec §2.2 and asserts the denial case for visitor, client-token and admin across every route. Missing coverage fails the test.
- **Rate limits (spec §6.22):** exceeding the booking-creation limit per IP and per email returns 429; a fourth live `pending_payment` booking for one email is refused.
- API responses carry HSTS, `X-Content-Type-Options`, a restrictive `Referrer-Policy`; the web app is served with a CSP that blocks inline script.
- Webhook and internal job endpoints reject unsigned or unauthenticated calls with no side effects.
- No stack trace, Prisma error text or SQL reaches a client response — the error middleware maps everything to a code and a message.
- axe scan on service list, service detail, slot picker, booking form and client booking page: zero critical violations; the full booking flow completes by keyboard alone.
- Lighthouse mobile on the two heaviest public pages: LCP under 2.5 s, initial payload under 500 KB excluding images.
- An induced exception reaches the error tracker; an induced payment-webhook failure raises an admin email alert.

---

## Task 25 — Flutterwave adapter and production cutover

**Goal.** Add the second `PaymentProvider` implementation, unlocking Airtel Money and cards, and prove the cutover leaves historic MTN payments intact (spec §4.3, §6.18, §6.19, C-4).

**Dependencies.** Tasks 17, 24.

**Verification.**
- With `PAYMENT_PROVIDER=flutterwave`, the capability endpoint reports MTN MoMo, Airtel Money and card, and the pay page renders all three; `our_ref` is sent as `tx_ref` and the returned id lands in `provider_ref`.
- **Cutover integrity (spec §6.18):** a database holding succeeded `mtn_momo_direct` payments still returns correct `booking_totals` after the switch, and an in-flight MTN webhook arriving post-switch is still accepted by the MTN handler — both routes stay mounted.
- Refund flagging resolves against the payment's own `provider`, not the configured one.
- The Flutterwave webhook verifies its signature against the raw body; a forged payload is stored `signature_valid = false` and applies nothing.
- The runbook documents the switch, the rollback, and that card and Airtel acceptance testing is only possible after cutover (**R-3**).

**Assumptions.** Flutterwave test credentials in development. Production settlement account ownership is **R-3** and blocks go-live, not this task.

---

## Coverage map

Every spec §6 edge case has an owning task; none is owned twice.

| Spec ref | Task |
|---|---|
| §6.1 double booking · §6.2 abandoned payment | 6 |
| §6.3 blocks · §6.4 block over confirmed booking | 8 |
| §6.5 timezone | 2 |
| §6.6 lead time · §6.7 buffer | 5 |
| §6.8 package too long · §6.14 deactivation | 10 |
| §6.9 webhook duplicate/late | 17 |
| §6.10 client cancel · §6.21 lost link | 18 |
| §6.11 admin cancel/reschedule · §6.12 no-show · §6.16 refunds | 19 |
| §6.13 price change after booking | 13 |
| §6.15 post-shoot add-ons | 20 |
| §6.17 calendar push failure | 14 (retry) + 22 (isolation) |
| §6.18 provider cutover · §6.19 method gating | 25 (16 for the MTN half) |
| §6.20 delivery expiry | 21 |
| §6.22 spam · §6.23 login attack | 24 (7 for lockout) |

## Not in this plan, deliberately

Out of scope per spec §4.2 and therefore absent by design: French content, SMS and WhatsApp, built-in photo hosting, two-way calendar sync, admin-created bookings with offline payment records (**R-1**), automated refunds, client-initiated rescheduling, custom booking form fields, reviews, discounts, multi-day bookings, accounting exports, native apps.
