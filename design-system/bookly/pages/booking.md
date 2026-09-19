# My Booking (client magic-link page) — Page Design

> **Project:** Bookly · **Phase 3 section:** 4
> **Route:** `/booking/:token` (the emailed private link). Its child `/booking/:token/payments/:ourRef` renders `PaymentProgressPage`; design that in `checkout.md`.
> **File:** `frontend/src/pages/booking/BookingPage.tsx` (contains `BookingView`, `Amounts`, `Delivery`, `SessionFee`, `Cancel`).
> Generator template: UI UX Pro Max, 2026-09-19 ("General", 1200px grid). Replaced: this is a single narrow account-style page.
> This file overrides `design-system/bookly/MASTER.md` for this page. Read MASTER's "Hand-review addendum" first.

## Who and how

The client opens this from an email, usually on a phone. The token in the URL is the whole of their identity, so the page shows no navigation and an invalid, expired or replaced link gets the same "link is not valid" page as one that never existed. Design for 375px first.

## Layout

`main`, `max-w-2xl`, `px-4 py-8`, `gap-6`. Sections in DOM order (keep it), each present only when relevant:

1. **Header row**: `h1` (3xl) + status pill (right, wraps under the title on narrow screens).
2. **Details card** (`dl`): reference (mono, semibold), service, when, location, people (if any), photos, requests (if any, `whitespace-pre-line`).
3. **Amounts card** (`dl`): package, add-ons, **total** (`border-t`, semibold), paid, **outstanding** (`font-medium`), refund due (only if > 0). Amounts right-aligned, `tabular-nums`. Outstanding is the actionable number: emphasise it when > 0. Refund due is informational: destructive-toned text plus its existing label.
4. **Delivery** (if `delivery`): title, optional note, then either "expired" text or the "Open photos" button (`asChild` external link, `target="_blank"`) with a muted expiry date.
5. **Session fee** (if `sessionFee`): card with title, intro carrying the amount, optional waiting banner, then `PaymentFields` and the pay button (`w-full sm:w-auto`), same look as the checkout page.
6. **Cancel** (if `canCancel`): a two-step control. Step 1 is an outline button. Step 2 shows the warning (`font-medium`, states the non-refundable fee) in a destructive-tinted callout, a **destructive** confirm button and an outline "keep" button. Confirm takes focus (`confirmRef`); keep that.
7. **Refused alert** and 8. **Cancelled summary** (if `cancelledAt`: title, reason, refund-due sentence).

Cards: one visual definition shared with the rest of the app (see MASTER "Card surface").

## Status pill

Today every status renders in one `bg-muted rounded-full` style, and `muted` is nearly invisible on the page background. Use the shared treatments in MASTER "Booking status treatments". The text label is always shown; tone and icon are secondary. This pill and the admin badges must look like the same system.

## States

loading (muted `role="status"`); load failed (destructive alert + outline retry); invalid link (`h1` + muted body); ok; cancelling; cancel failed / refused; session fee: waiting payment, no methods, phone invalid, start failed.

## Do not

- No account chrome, avatar or logout: the client has no account.
- Do not compute or "fix up" any amount; every number is the API's.
- No new copy; no confirmation dialog (the two-step inline control is the design).
