# Admin Booking Detail — Page Design

> **Project:** Bookly · **Phase 3 section:** 7 (with the bookings list)
> **Route:** `/admin/bookings/:id` · **File:** `frontend/src/pages/admin/AdminBookingDetail.tsx` (with `Section`, `Line`, `Payments`, `RefundForm`, `DeliveryForm`, `AddonForm`, `RescheduleForm`, `CancelForm`)
> Generator template: UI UX Pro Max, 2026-09-19 ("Dashboard / Data View", 1200px). Replaced by the shipped `max-w-3xl`.
> This is the **highest-risk screen in the redesign**: money due, refunds, and destructive cancel/refund actions on one page. Every action button follows the API's own `actions` flags; the API enforces them again.
> This file overrides `design-system/bookly/MASTER.md` for this page. Read MASTER's "Hand-review addendum" first.

## Layout (keep one column, keep the order)

`Shell`: `main`, `max-w-3xl`, `px-4 py-6`, `gap-6`, with a muted back link "<- Bookings" first. Keep the single readable column (line length matters here); do not split into two columns.

1. **Header:** `h1` = the reference (mono, 2xl, semibold) and the status badge (shared treatment from MASTER), wrapping under on narrow screens.
2. **Failure line** (`role="alert"`, destructive, `text-sm`) directly under the header when an action fails.
3. **Sections**, each a `rounded-xl` card, `p-4`, `gap-2`, with an `h2` (lg semibold): Shoot -> Client -> Money -> Payments -> Delivery (conditional) -> Actions -> Messages.
4. `Line` = term (muted) left, value right, wrapping, `text-sm`.

The cards here are hand-rolled (`rounded-xl border p-4`); they must look identical to `card.tsx` and to the client pages (MASTER "Card surface").

## Money section (the part that must never be misread)

- Right-align amounts, `tabular-nums`. Rows: package, each add-on (with `× n` and "post-shoot" tag), **total** (semibold), **collected**, **outstanding**, **refund due** (only if > 0).
- **Outstanding** (still to pay): semibold foreground, so it reads as "action needed". **Refund due** ("to refund"): semibold destructive text. Both keep their existing labels; tone and an icon are extra, never the only cue.
- Add-on "Remove" is a tiny destructive text button today (`text-xs`). Make it a proper small ghost-destructive button with a hit area of at least 24px (44px on touch). Keep `aria-disabled`.
- Post-shoot add-on form (`AddonForm`): native `select` styled like the inputs (border token, height, focus ring), quantity input `w-20`, outline "Add". Its loading and failed states stay as `role="status"` / `role="alert"`.

## Payments section

One `li` per payment: kind · amount (`tabular-nums`) on the left, status · settled time on the right (muted); provider and reference line below (muted, small, mono is fine); `RefundForm` inline when `canRecordRefund` (reference input `w-56` + outline "Record refund <amount>" + note). Failed or refund-due payment statuses get destructive text **and** their existing words.

## Delivery section (only when editable or a link exists)

Sent / unsent line; URL input (`type="url"`), expiry date input (`w-44`) with its hint, note textarea; **Save** (outline `sm`) and **Send / Send again** (default `sm`, `aria-disabled` while busy) side by side; hint text below. Read-only mode shows URL and expiry as `Line`s.

**Confirm step (2026-09-25, user request).** Send / Send again no longer sends: it opens an inline step below the form (`ConfirmRecipient`, the cancel form's pattern, no modal) with "Send the photo link to:" and an email input prefilled with the booking's contact email, then **Send now** (default `sm`) and **Back** (outline `sm`). A changed address goes to the API as `recipient` and is used **for that one email only**; the booking keeps its contact email. The Messages list names a recipient (" · to …") only when it differs from the booking's address.

**Notes to the client (2026-09-25, prompt item 8).** A section before Messages sent, once the booking has been confirmed: the notes newest first (text with its line breaks, when, "Emailed" or "On the page only", and a ghost red Delete with an inline confirm that says an email already sent stays sent), then a form: New note (textarea, `maxLength` 1000, a live "n of 1000"), **Also email it to the client** (a checkbox, ticked by default: user decision), and **Add the note** (default `sm`). The form clears only when the note is saved. The client sees each note on their booking page as "From your photographer" until a photographer profile exists.

**Before completion (2026-09-25).** On a `confirmed` booking whose shoot has begun, the Delivery section appears with one muted line, "Photo delivery opens once you mark this booking completed.", so the photographer can find where the link will go.

## Actions section (destructive care)

Today's order: reschedule, cancel, request session fee, [complete, no-show, resend link], notes.

- **Separate the destructive action visually.** Keep Cancel out of the row of routine buttons: give its block its own top border and spacing (`border-t`, `pt-4`), optionally a very light destructive-tinted surface. Reordering the DOM so Cancel comes last is allowed but optional; separation by spacing and border is the safe minimum.
- Cancel is two-step. Opener: the tinted `destructive` variant. **Confirm: a solid destructive button** (`bg-destructive text-white`, hover slightly darker) so an irreversible action is unmistakable and passes contrast (white on red-700 is 6.47:1; the tinted variant is only 4.13:1 with the generated red). The warning text stays `font-medium` and above the reason field.
- Routine buttons (complete, no-show, resend) are outline; "Request session fee" is the single default (primary) button of the section.
- Reschedule: `datetime-local` input `w-60` + outline "Move" + note. It is Kigali wall time (fixed +02:00); do not touch the offset logic.
- While an action runs, buttons use `aria-disabled` (not `disabled`) so focus is kept. **Style `aria-disabled=true`** (reduced opacity, `cursor-not-allowed`); today they look fully active during a request (MASTER, Button notes).

## Messages section

List rows: template name · date on the left, delivery status (+ last error) on the right, muted. A failed status uses destructive text plus its words.

## States

loading, load failed (alert), missing (404 `h1`), ready; action busy; action refused (409 replaces the booking on screen: no layout jump); every conditional section absent and present.

## Do not

- No modal confirm, no toasts, no undo, no tabs, no two-column split, no new copy.
- Do not change action gating (`actions.*`) or any request logic.
