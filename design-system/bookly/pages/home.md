# Home — Page Design

> **Project:** Bookly · **Route:** `/` · **File:** `frontend/src/pages/Home.tsx` · **Phase 3 section:** 1
> Generator template: UI UX Pro Max, 2026-09-19. Its page text ("Landing / Marketing", 1200px width) was wrong for this page and is replaced by the hand-written notes below.
> This file overrides `design-system/bookly/MASTER.md` for this page. Read MASTER's "Hand-review addendum" first; its constraints apply to every page.
> **Applied 2026-09-20 (Phase 3 section 1).** What was chosen beyond this file (the button hugs its label, the dot colours) is in `MASTER.md` section 11.

## What this page actually is

Home is **not a landing page**. Today it is an API health check: the app name, one status line and a "Check again" button (`common:appName`, `home:apiStatus` / `reachable` / `checking`, `home:recheck`). No spec or plan document mentions a home page or landing content (searched `docs/plan.md`, `docs/specs_v2.md`). The public entry point that clients actually use is `/services`.

The generator's landing-page pattern (hero, problem, solution, CTA) therefore does **not** apply. Building it would need new copy in `en.json` (protected) and would change what the page is for.

**Decided 2026-09-20: restyle the stub only.** A real landing page (hero, services teaser, link to `/services`) is a separate task with its own copy, tracked in `docs/redesign-pending.md`. Phase 3 restyles exactly what exists.

## Layout (keep the shipped structure)

- One centred column: `main`, `max-w-md`, `min-h-svh`, vertically centred, `p-6`, `gap-4`. Keep.
- Order: `h1` app name -> status line (`role="status"`) -> "Check again" button.
- Wordmark: `h1` in the heading font (Poppins, semibold), larger than today's `text-2xl`; `text-3xl` is enough.
- Status line: muted text. May gain a small status dot before the existing text (green when reachable, destructive when the fetch failed, muted while checking). The dot is decoration paired with the existing words, never the only signal.
- Button: default variant, unchanged label and `onClick` (`window.location.reload()` stays).

## States to cover

- checking (muted), reachable, error (the raw error string is shown; give it `text-destructive` and let long strings wrap: `overflow-wrap: anywhere`).

## Do not

- No hero, no marketing sections, no new copy, no imagery.
- Do not touch the `fetch` in `useEffect` or the `Health` type.
