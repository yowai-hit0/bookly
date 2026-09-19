# Admin Calendar — Page Design

> **Project:** Bookly · **Phase 3 section:** 6
> **Route:** `/admin/calendar` (lazy-loaded: FullCalendar and Luxon are the heaviest code in the app, so add no new imports to this chunk)
> **Files:** `frontend/src/pages/admin/AdminCalendar.tsx` **and the FullCalendar block in `frontend/src/index.css` (lines 131-179)**. A pass that only scans `.tsx` files will miss the CSS, which is where most of this page's look lives. Section 6 needs an explicit, named CSS pass.
> Generator template: UI UX Pro Max, 2026-09-19 ("Dashboard / Data View", 1200px). Replaced.
> This file overrides `design-system/bookly/MASTER.md` for this page. Read MASTER's "Hand-review addendum" first.

## Layout (keep)

`main`, `max-w-7xl`, `p-4`, `gap-4`. Order: title block (`h1` xl semibold + `text-xs` muted timezone note) -> loading `role="status"` -> failed `role="alert"` with outline `sm` retry -> the calendar.

Do not change the constants in the TSX: `TIME_GRID_HEIGHT` (760), `SCROLL_TIME` (08:00), `HEADER_TOOLBAR`, the view options. They are behaviour, not styling.

## Calendar chrome (CSS, `.fc` block)

The `.fc` block already reads the app tokens (`--fc-border-color`, `--fc-neutral-bg-color: var(--muted)`, `--fc-today-bg-color: primary 6%`, active button = `--primary`), so a token change carries most of it. What still needs deliberate CSS:

- **Toolbar on small screens:** three button groups plus the title do not fit one row at 375px. Let `.fc-toolbar` wrap, put the title on its own line, keep buttons >= 36px tall.
- **Typography:** `font-size: 0.875rem` and the title's `1.125rem` are hard-coded and independent of the type scale. Set the title in the heading font. Keep the sizes unless the scale demands otherwise.
- **Neutral surfaces:** `--fc-neutral-bg-color` uses `muted`. If MASTER's `muted` is left at its generated value it is invisible against the page (see MASTER addendum, section 3 and D3).
- Focus ring on toolbar buttons already uses `--ring`; keep.

## Events: the functional visual cues (Section 6 milestone)

Event DOM: `EventContent` renders time (tabular), contact name (truncated), a **status chip** (`border border-current`, visible text, never colour alone) and, when a booking overlaps a block, a **conflict badge** (`bg-destructive text-white` + `TriangleAlert` icon). Week and day views add "service · package · reference" (bookings) or the block's private reason.

Event classes (set in `calendar-events.ts`, do not edit): `bookly-event`, `bookly-event--block`, `bookly-event--<status>` for the seven statuses, `bookly-event--conflict`.

**Verified problem to fix:** today every event uses FullCalendar's default fill and border, `--fc-event-bg-color: #3788d8` and `--fc-event-border-color: #3788d8` (checked in the installed package). Only `conflict` and `pending_payment` have any rule in `index.css`. Consequences:

1. **`pending_payment` dashed border is invisible.** A dashed border in the same colour as the fill cannot be seen. The cue only works if the fill differs from the border. Design pending events as **outlined**: light or card fill with a **dashed** border in the brand colour.
2. All other statuses look identical apart from their chip text. Give them the shared treatments in MASTER "Booking status treatments" (fill, border style and tone), so the calendar, the bookings list and the booking page agree.

Set `--fc-event-bg-color`, `--fc-event-border-color` and `--fc-event-text-color` from tokens in `.fc`, then override per `.bookly-event--<status>`. Text on any event fill must stay >= 4.5:1.

- **Conflict** (`.bookly-event--conflict`): 2px `--destructive` outline, `outline-offset: -2px`, visible at any event size. It must stay readable on top of each fill, and no status treatment may use a 2px destructive border of its own (or the cue is lost). Check conflict + `confirmed` and conflict + `pending_payment` explicitly.
- **Block** (`.bookly-event--block`): muted fill plus a diagonal hatch (repeating gradient), so "blocked" is a pattern, not only a colour.
- **Chip sizes:** the chip and conflict badge are `0.65rem` (about 10px). Raise to `0.75rem` where the event has room (week, day). Month cells stay dense but not below `0.7rem`.

## States

loading, load failed (alert + retry), month / week / day views, all-day blocks, overlapping events, empty range.

## Do not

- No custom event popovers, drag-and-drop styling, resource views or extra plugins: none exist and each adds weight to the lazy chunk.
- No new copy.
