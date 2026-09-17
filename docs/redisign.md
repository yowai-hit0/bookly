# Bookly Visual Redesign — UI UX Pro Max → Impeccable

## Context

The Bookly frontend (`frontend/`, a Vite + React 19 + TypeScript SPA) has never had a real visual design pass — Tailwind v4 + shadcn/ui (`radix-nova` style) is wired up correctly, but `frontend/src/index.css` is still pure grayscale (`oklch(... 0 0)` everywhere) and page markup is mostly bare Tailwind utility classes. The goal is a full visual redesign of both the client-facing booking flow and the admin panel — **without touching any business/data logic** — using two third-party Claude Code skills the user wants to bring in:

- **UI UX Pro Max** (`github.com/nextlevelbuilder/ui-ux-pro-max-skill`) — a *generator*: picks a UI style, an industry-tuned color palette, and a font pairing, then applies a full design system.
- **Impeccable** (`impeccable.style`) — a *polisher*: works on an existing system, respects tokens/`DESIGN.md`, and cleans up spacing/typography/consistency + generic "AI-slop" patterns via `/impeccable polish`/`critique`/`distill`.

Decisions already confirmed with the user:
- Use **both**, in sequence: generate the system once, then polish page-by-page.
- **One unified visual system** across client + admin (they already share `components/ui/*` and one token file, so this is the natural fit, not extra work).
- Let UI UX Pro Max **auto-pick** the style/palette for a services/booking business — no manual brand direction.
- Roll out **client-facing pages first**, admin second.

## Verified codebase facts

- One SPA, no separate admin app. Routes centrally declared in `frontend/src/routes.tsx`.
- All design tokens live in **one file**: `frontend/src/index.css` — confirmed structure: `@import` block (`tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, Geist font) → `@custom-variant dark` → `@theme inline` (token→CSS-var mapping + radius scale) → `:root` (light tokens) → `.dark` (dark tokens, currently unreachable — nothing in source adds a `dark` class) → `@layer base` → FullCalendar override block at **lines 131–179** (color vars inherit from tokens automatically; `font-size: 0.875rem`/`1.125rem` are hardcoded, independent of any type-scale token).
- `frontend/components.json` confirms shadcn `style: radix-nova`, `baseColor: neutral`, `cssVariables: true`, `tailwind.config: ""` (Tailwind v4 CSS-first — **no `tailwind.config.js` exists or should be created**).
- Shared primitives: `frontend/src/components/ui/{button,card,input,label,checkbox,textarea,tabs,badge}.tsx`, used by both client and admin pages.
- Client routes (6): `pages/Home.tsx` (`/`), `pages/services/{ServiceList,ServiceDetail,SlotPicker,BookingDetailsForm,PriceSummary,BookingHeld}.tsx` (`/services`, `/services/:slug`), `pages/checkout/{CheckoutPage,PaymentProgressPage}.tsx`, `pages/NotFound.tsx`.
- Admin routes (3, under `/admin`, shell `frontend/src/admin/AdminLayout.tsx`): `pages/admin/AdminLogin.tsx`, `pages/admin/AdminCalendar.tsx` (wraps FullCalendar), `pages/admin/{AdminCatalogue,EntityForm}.tsx`.
- **Never touch** (pure logic, has matching `.test.ts` files): `frontend/src/catalogue/{api,bookings,availability,payments}.ts`, `frontend/src/admin/{api,session,catalogue,calendar-dates,calendar-events}.ts`, `frontend/src/i18n/locales/en.json` (copy, not visual).
- `package.json` scripts confirmed: `dev`, `build`, `typecheck` (`tsc -b --noEmit`), `lint` (`oxlint`), `test` (`vitest run`), `test:e2e` (`playwright test`).

## Phase 0 — Branch & rollback scaffolding

1. Confirm clean working tree, branch off `main` as `redesign/visual-only`. All work happens here; `main` untouched until final merge.
2. Commit convention: `chore:` (skill install), `design:` (UI UX Pro Max), `polish:` (Impeccable). One invocation per commit — never batch two tool runs into one commit.
3. Stage explicit paths only (never `git add -A`), so an unexpected touched file is visible before it enters history.

## Phase 1 — Install the skills

Install **UI UX Pro Max first**; install **Impeccable right before Phase 3** (it scans for an existing design system, so it should see UI UX Pro Max's finished, committed output, not a half-applied one).

**UI UX Pro Max** — pick one path (needs explicit approval; touches outside the repo / hits network):
- Plugin marketplace (global `~/.claude` config): `/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill` then `/plugin install ui-ux-pro-max@ui-ux-pro-max-skill`.
- Global npm CLI (writes into repo's `.claude/skills/` — do not hand-edit those files): `npm install -g ui-ux-pro-max-cli` then `uipro init --ai claude`.

**Impeccable**: `npx impeccable install` from the repo root, right before Phase 3. Verify with the read-only `/impeccable critique` before ever running `/impeccable polish`.

## Phase 2 — Foundation pass (UI UX Pro Max, run once)

This is the one point where style/palette/type get decided — must happen exactly once so the whole app stays one system.

**Before running**: explicitly instruct it to only rewrite oklch values inside `:root`/`.dark` and Tailwind classNames in existing files — not introduce a new theming mechanism, not bypass shadcn conventions, not scaffold a `tailwind.config.js` (Tailwind v4 + `@tailwindcss/vite` means such a file would silently do nothing — a false-positive "it worked" trap), and not delete the `@import "shadcn/tailwind.css"` line (a tool may mistake it for a duplicate of the `tailwindcss` import).

- **Scope**: `frontend/src/index.css` (token values only) + `frontend/src/components/ui/*.tsx`.
- **Explicitly out of scope**: everything under `frontend/src/pages/`, `frontend/src/admin/AdminLayout.tsx`, `components.json`, and the full protected/logic list below.

**Checkpoint**: `npm run dev`, visually check `/` and `/admin/login` (both consume the same primitives/tokens, so global changes should already show). Run `npm run typecheck && npm run lint && npm run test`. Diff-review, commit, tag `redesign-foundation-done`.

## Phase 3 — Section-by-section rollout (client → admin)

Install Impeccable now if not already. Loop per section: **UI UX Pro Max scoped apply → checkpoint → Impeccable polish → checkpoint → commit**.

| # | Section | Files |
|---|---------|-------|
| 1 | Home + NotFound | `pages/Home.tsx`, `pages/NotFound.tsx` |
| 2 | Services / booking flow | `pages/services/{ServiceList,ServiceDetail,SlotPicker,BookingDetailsForm,PriceSummary,BookingHeld}.tsx` |
| 3 | Checkout flow | `pages/checkout/{CheckoutPage,PaymentProgressPage}.tsx` |
| 4 | Admin shell + login | `admin/AdminLayout.tsx`, `pages/admin/AdminLogin.tsx` |
| 5 | Admin calendar | `pages/admin/AdminCalendar.tsx` + FullCalendar CSS block (`index.css` lines 131–179) — needs an explicit named pass since a tool scanning only `.tsx` files won't touch it |
| 6 | Admin catalogue | `pages/admin/{AdminCatalogue,EntityForm}.tsx` |

After each section's apply: dev-server visual check of that section's routes, full test gate, diff-review, commit. After each section's polish: re-check, optionally re-run `/impeccable critique`, same gate, commit.

**Milestone after Section 3** (all client pages done — user's stated priority): full manual click-through of the live booking funnel (Home → ServiceList → ServiceDetail → SlotPicker → BookingDetailsForm → PriceSummary → BookingHeld → Checkout → PaymentProgress), since layout breaks in stateful multi-step flows may only appear mid-flow. Run `npm run test:e2e`. Tag `redesign-client-done`.

**Milestone after Section 5**: verify `.bookly-event--conflict` (destructive outline) and `.bookly-event--pending_payment` (dashed border) — functional visual cues, not decoration — stay legible against the new palette.

**Milestone after Section 6**: verify EntityForm's destructive/error states and Tabs/Badge usage stay legible and consistent.

## Phase 4 — Final cross-cutting pass

Once all 6 sections are done, run `/impeccable distill` once across the whole app to consolidate redundant patterns. Then: full test gate (`typecheck`, `lint`, `test`, `test:e2e`), `git diff main --stat` to confirm the touched-file list matches expectations (zero hits on the protected list), one more full visual pass over all 9 routes for consistent radius/color/spacing/type. Only then merge `redesign/visual-only` into `main`.

## Guardrails — protected files (verify absent from every diff, every invocation)

- `frontend/src/catalogue/{api,bookings,availability,payments}.ts` (+ `.test.ts`)
- `frontend/src/admin/{api,session,catalogue,calendar-dates,calendar-events}.ts` (+ `.test.ts`)
- `frontend/src/i18n/locales/en.json` — copy/content, not visual
- `frontend/components.json`, `frontend/vite.config.ts`, lockfiles — review separately if touched, never accept as part of a visual commit

State this list verbatim in every prompt given to either skill. Working tree must be clean before every invocation so its diff is fully attributable; read the full `git diff` (not skim) before staging explicit paths.

## Rollback strategy

- All work on `redesign/visual-only`; `main` stays deployable throughout.
- Two commits per section (apply + polish) → fine-grained `git revert` of one tool's pass without touching neighbors.
- Tags at `redesign-foundation-done` (end of Phase 2) and `redesign-client-done` (end of Section 3) as safe fallback points.
- Plugin-marketplace installs live in global `~/.claude` config (outside git) — uninstall via `/plugin uninstall` if needed; npm-CLI-based `.claude/skills/` scaffolding is tracked by git and reverts with the branch.

## Verification

- After every section: `npm run typecheck && npm run lint && npm run test` from `frontend/`.
- After client sections complete and again at the end: `npm run test:e2e` (Playwright) plus a manual click-through of the booking funnel in `npm run dev`.
- Final check before merge: `git diff main --stat` shows no hits on the protected file list; full visual pass across all 9 routes.
