# Admin Bookings List — Page Design

> **Project:** Bookly · **Phase 3 section:** 7 (with booking detail)
> **Route:** `/admin/bookings` · **File:** `frontend/src/pages/admin/AdminBookings.tsx`
> Generator template: UI UX Pro Max, 2026-09-19 ("Dashboard / Data View", 1200px). Replaced by the shipped `max-w-6xl`.
> This is a **data-dense operate screen** (statuses, money due, refunds). Legibility beats decoration.
> This file overrides `design-system/bookly/MASTER.md` for this page. Read MASTER's "Hand-review addendum" first.

## Layout (keep the order)

`main`, `max-w-6xl`, `px-4 py-6`, `gap-4`. Order: `h1` (2xl) -> filter section -> failed alert -> loading / empty text -> table -> "Load more".

**Width budget (admin sidebar):** from `lg` the sidebar (`pages/admin-shell.md`) takes 240px. The table needs 800px (`min-w-[48rem]` plus the page's `px-4`), so it stops scrolling sideways from a 1040px viewport; at 1024-1039px it scrolls by a few pixels inside `overflow-x-auto`, which is acceptable.

### Filter section (`aria-label`)

- Row 1: **stage toggle buttons** (ten since 2026-09-25, one per display stage, MASTER section 7; the URL carries `?stage=`, and an older `?status=` link opens on the stages that status now spans), `flex-wrap`, `size="sm"`. Pressed = default (filled) variant, unpressed = outline. Pressed vs unpressed must differ by more than hue: fill vs outline is enough; a small check icon on pressed is a good extra. Do not shorten labels.
- Row 2: From date, To date (`w-44`), search (`w-64`) + outline "Apply", and a ghost "Clear" that appears only when a filter is active. Labels above inputs, `items-end` so buttons align with inputs.
- Filters live in the URL; the layout must not depend on any local-only state.

### Table

- Inside `overflow-x-auto`, `min-w-[48rem]`, `border-collapse`, `text-sm`. **Keep real table semantics** (caption, `th scope="col"`); on phones the table scrolls horizontally rather than turning into cards. Make the scroll obvious (edge fade or visible scrollbar).
- Header row: `border-b`, muted, medium weight. Body rows: `border-b`, `hover:bg-muted/50` (hover must be visible: see MASTER addendum D3 on `muted`), `align-top`, `py-2` to `py-3`.
- Columns: **When** (date, then time range muted, `whitespace-nowrap`), **Reference** (link, mono, medium, underline on hover and visible focus), **Client** (name, email muted; let long emails wrap), **Service** (name, package muted), **Status** (badge), **Money**.
- **Money column** (right-aligned, `tabular-nums`): grand total, then "still to pay" (muted, only if > 0), then "to refund" (destructive text, only if refund due). Both extra lines keep their words; colour is secondary. Destructive text must be >= 4.5:1 on the row background.
- **Status badge:** all seven currently render as the same `outline` badge. Use the shared treatments in MASTER "Booking status treatments". They must stay distinguishable in greyscale (fill / outline / dashed / dotted plus a different icon each).

### Load more

Outline button, `self-start`, `aria-busy` while loading.

## States

loading (first load), filtered-empty (muted sentence), load failed (destructive `role="alert"`), loading more, filters active (Clear visible).

## Do not

- No zebra striping that competes with row hover, no sticky columns, no bulk-select, sorting or export: none exist.
- No new copy; do not change the URL-filter behaviour.
