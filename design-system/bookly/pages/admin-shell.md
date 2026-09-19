# Admin Shell (layout route) — Page Design

> **Project:** Bookly · **Phase 3 section:** 5 (with admin login)
> **Route:** `/admin` layout route; wraps `calendar`, `catalogue`, `bookings`, `bookings/:id` through `<Outlet />`. `/admin` itself redirects to `calendar`.
> **File:** `frontend/src/admin/AdminLayout.tsx`
> **Added by the discovery rule:** it is a route in `routes.tsx` but was not on the Phase 2a page list. It is in the Phase 3 table (row 5, "Admin shell + login") but had no design file.
> Generator template: UI UX Pro Max, 2026-09-19 ("Dashboard / Data View"). The 1200px width is wrong here; each admin page sets its own width.
> This file overrides `design-system/bookly/MASTER.md` for this page. Read MASTER's "Hand-review addendum" first.

## Structure (keep)

`div.min-h-svh` > `header` (flex, space-between, `border-b`) > `nav[aria-label]` + sign-out button; then `<Outlet />`. Each child page renders its **own** `main` with its **own** width: calendar `max-w-7xl`, bookings `max-w-6xl`, catalogue `max-w-5xl`, booking detail `max-w-3xl`. The shell must not impose a width on them.

The session guard (`Navigate` to `/admin/login`) and `signOut` are logic; do not touch.

## Header bar

- Surface: `bg-card` with `border-b` (or a very light shadow). Inner content in a `max-w-7xl mx-auto px-4` container so it aligns with the widest page. Do not make it `sticky` unless focus-not-obscured is verified against the calendar and long forms; static is the safe default.
- Left: wordmark (`common:appName`, heading font, semibold) then three `NavLink`s (calendar, bookings, catalogue), `text-sm`.
- Nav item states: default muted; hover = `muted` pill or underline; **active = clear indicator that is not colour alone** (semibold + 2px bottom bar or filled pill). `NavLink` already sets `aria-current="page"`; style from it.
- Right: sign-out, ghost `sm` with the `LogOut` icon.

## Small screens (verify at 375px)

Wordmark + three links + sign-out is too wide for one row today. Allow the nav to wrap or tighten gaps, keep each link a comfortable touch target (>= 44px tall), and at `< sm` hide the sign-out **text** visually (`sr-only sm:not-sr-only`) so only the icon remains; the accessible name stays.

## Do not

- No sidebar, drawer, breadcrumbs, user avatar or notification badge: none exist.
- No new copy.
