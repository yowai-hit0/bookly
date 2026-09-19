# Not Found — Page Design

> **Project:** Bookly · **Route:** `*` (and rendered inside `/services/:slug`) · **File:** `frontend/src/pages/NotFound.tsx` · **Phase 3 section:** 1
> **Added by the discovery rule:** it was not on the Phase 2a page list. It is in the Phase 3 table (row 1, "Home + NotFound") but had no design file.
> Generator template: UI UX Pro Max, 2026-09-19. Its recommendations ("padding-top for the nav", "AAA focus criterion", "word-break") were unrelated boilerplate; this page has no nav. Replaced below.
> This file overrides `design-system/bookly/MASTER.md` for this page.

## Layout

- Same shell as Home: `main`, `max-w-md`, `min-h-svh`, centred, `p-6`, `gap-2`.
- Order: `h1` (`notFound:title`, 2xl semibold, heading font) -> muted body (`notFound:body`).
- May gain a decorative icon above the heading (lucide, `aria-hidden`, muted, ~40px). No "404" numeral: it would be new text.

## Two callers, one component

`NotFound` is also returned by `ServiceDetail` when the API answers 404 for a slug (unknown or deactivated service, spec 6.14). It renders its own `main`, so it must stay self-contained and must not assume it is a top-level route.

## Known gap (needs a decision, not a design pass)

The page has no way out: no link home or to `/services`. Adding one needs a new string in `en.json` (protected) unless an existing key can be reused. Flag it; do not invent copy.

## Do not

- No new copy, no illustration that carries meaning, no nav.
