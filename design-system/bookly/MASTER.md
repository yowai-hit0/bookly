# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/bookly/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.

---

**Project:** Bookly
**Generated:** 2026-09-19 15:12:03
**Category:** Booking & Appointment App

---

## Global Rules

### Color Palette

| Role | Hex | CSS Variable |
|------|-----|--------------|
| Primary | `#0284C7` | `--color-primary` |
| On Primary | `#000000` | `--color-on-primary` |
| Secondary | `#0EA5E9` | `--color-secondary` |
| On Secondary | `#000000` | `--color-on-secondary` |
| Accent/CTA | `#059669` | `--color-accent` |
| On Accent/CTA | `#000000` | `--color-on-accent` |
| Background | `#F0F9FF` | `--color-background` |
| Foreground | `#0F172A` | `--color-foreground` |
| Card | `#FFFFFF` | `--color-card` |
| Card Foreground | `#0F172A` | `--color-card-foreground` |
| Muted | `#EFF7FB` | `--color-muted` |
| Muted Foreground | `#475569` | `--color-muted-foreground` |
| Border | `#E0F0F8` | `--color-border` |
| Destructive | `#DC2626` | `--color-destructive` |
| On Destructive | `#FFFFFF` | `--color-on-destructive` |
| Ring | `#0284C7` | `--color-ring` |

**Color Notes:** Calendar blue + available green

### Typography

- **Heading Font:** Poppins
- **Body Font:** Open Sans
- **Mood:** modern, professional, clean, corporate, friendly, approachable
- **Google Fonts:** [Poppins + Open Sans](https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap)

**CSS Import:**
```css
@import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap');
```

### Spacing Variables

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | `4px` / `0.25rem` | Tight gaps |
| `--space-sm` | `8px` / `0.5rem` | Icon gaps, inline spacing |
| `--space-md` | `16px` / `1rem` | Standard padding |
| `--space-lg` | `24px` / `1.5rem` | Section padding |
| `--space-xl` | `32px` / `2rem` | Large gaps |
| `--space-2xl` | `48px` / `3rem` | Section margins |
| `--space-3xl` | `64px` / `4rem` | Hero padding |

### Shadow Depths

| Level | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | Subtle lift |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.1)` | Cards, buttons |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | Modals, dropdowns |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.15)` | Hero images, featured cards |

---

## Component Specs

### Buttons

```css
/* Primary Button */
.btn-primary {
  background: var(--color-accent);
  color: var(--color-on-accent);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}

.btn-primary:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

/* Secondary Button */
.btn-secondary {
  background: transparent;
  color: var(--color-primary);
  border: 2px solid var(--color-primary);
  padding: 12px 24px;
  border-radius: 8px;
  font-weight: 600;
  transition: all 200ms ease;
  cursor: pointer;
}
```

### Cards

```css
.card {
  background: var(--color-card);
  border-radius: 12px;
  padding: 24px;
  box-shadow: var(--shadow-md);
}

/* Only cards that are links/buttons (the service card on /services) get pointer + hover. */
.card--interactive {
  transition: box-shadow 200ms ease;
  cursor: pointer;
}

.card--interactive:hover {
  box-shadow: var(--shadow-lg);
}
```

### Inputs

```css
.input {
  padding: 12px 16px;
  border: 1px solid var(--color-input);
  border-radius: 8px;
  font-size: 16px;
  transition: border-color 200ms ease;
}

.input:focus {
  border-color: #0284C7;
  outline: none;
  box-shadow: 0 0 0 3px #0284C720;
}
```

### Modals

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  box-shadow: var(--shadow-xl);
  max-width: 500px;
  width: 90%;
}
```

---

## Style Guidelines

**Style:** Soft UI Evolution

**Keywords:** Evolved soft UI, better contrast, modern aesthetics, subtle depth, accessibility-focused, improved shadows, hybrid

**Best For:** Modern enterprise apps, SaaS platforms, health/wellness, modern business tools, professional, hybrid

**Key Effects:** Improved shadows (softer than flat, clearer than neumorphism), modern (200-300ms), focus visible, measured contrast targets

### Page Pattern

**Pattern Name:** Funnel (3-Step Conversion)

- **Conversion Strategy:** Progressive disclosure. Show only essential info per step. Use progress indicators. Multiple CTAs.
- **CTA Placement:** Each step: mini-CTA. Final: main CTA
- **Section Order:** Hero > Step 1 (problem) > Step 2 (solution) > Step 3 (action) > CTA progression

> **Hand-review note:** this pattern is a landing-page recipe and is **not applied literally**. Bookly has no landing page. See addendum section 8 for the patterns the app really uses.

---

## Anti-Patterns (Do NOT Use)

- ❌ Complex shadows
- ❌ 3D effects

### Additional Forbidden Patterns

- ❌ **Emojis as icons** — Use SVG icons (Heroicons, Lucide, Simple Icons)
- ❌ **Missing cursor:pointer** — All clickable elements must have cursor:pointer
- ❌ **Layout-shifting hovers** — Avoid scale transforms that shift layout
- ❌ **Low contrast text** — Maintain 4.5:1 minimum contrast ratio
- ❌ **Instant state changes** — Always use transitions (150-300ms)
- ❌ **Invisible focus states** — Focus states must be visible for a11y

---

## Pre-Delivery Checklist

Before delivering any UI code, verify:

- [ ] No emojis used as icons (use SVG instead)
- [ ] All icons from consistent icon set (Heroicons/Lucide)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Hover states with smooth transitions (150-300ms)
- [ ] Light mode: text contrast 4.5:1 minimum
- [ ] Focus states visible for keyboard navigation
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content hidden behind fixed navbars
- [ ] No horizontal scroll on mobile

---

## Hand-review addendum (Phase 2a)

> Written by hand on 2026-09-19 from the shipped code and measured contrast, after reviewing the generator output. **Where this addendum and the generated text above disagree, this addendum wins.** A file in `pages/` wins over both, for its own page.
> **Status: proposed. Section 9 lists the decisions the user must make before Phase 2b.**

### 1. Corrections made in place to the generated text

| Where | Generated | Now | Why |
|-------|-----------|-----|-----|
| Header "LOGIC" line | `design-system/pages/[page-name].md` | `design-system/bookly/pages/[page-name].md` | The real path includes the project slug. The same wrong path was in every generated page file. |
| `.btn-primary` | `background: #059669; color: white` | `var(--color-accent)` / `var(--color-on-accent)` | White on `#059669` is 3.77:1, failing this file's own 4.5:1 rule. The palette table says the on-accent colour is black. |
| `.btn-secondary` | hard-coded `#0284C7` | `var(--color-primary)` | Tokens, not raw hex (this file's own rule). Blue text on white is only 4.10:1, see section 3. |
| `.card` | `background: #F0F9FF` (the page background), pointer, lift on every card | `var(--color-card)`; pointer and lift only on `.card--interactive` | The palette says Card is `#FFFFFF`; a card the colour of the page is invisible. Only the service card on `/services` is clickable. |
| `.input` | `border: 1px solid #E2E8F0` | `var(--color-input)` | 1.23:1 against white. A control's boundary needs 3:1 (WCAG 1.4.11). |
| Page Pattern | "Funnel (3-Step Conversion)": Hero > Step 1 (problem) > ... | kept, with a note | It is a landing-page recipe. See section 8. |

The generated page files were also wrong and are replaced: 1200px widths that match no page, "Landing / Marketing" for Home, "WebGL/Three.js 3D, physics lighting, parallax" for the booking funnel, and "add padding-top for the nav" for a page with no nav.

### 2. Constraints that override the generator

- **No new user-visible strings.** `frontend/src/i18n/locales/en.json` is protected. Restyle existing text; decoration must be non-textual (icons with `aria-hidden`, CSS counters, borders, fills, dots).
- **Behaviour is fixed.** Keep DOM order, `role` / `aria-*`, focus management (headings with `tabIndex=-1` that receive focus), `aria-disabled` instead of `disabled` during requests (15 places in four files), `noValidate` forms and list `key`s.
- **Light theme only.** `.dark` is unreachable (nothing adds the class). No dark palette was generated. Leave the `.dark` block untouched in Phase 2b unless the user asks for dark mode; it will stay grayscale.
- **No modals** (the app uses inline confirmation and one `window.confirm`), **no 3D, parallax or scroll-driven effects.** Motion is 150-300ms state transitions only, behind `motion-safe` / `prefers-reduced-motion`.
- **Avoid what Impeccable's detector flags** (from `.claude/skills/impeccable/reference/hooks.md`): gradient text, glow shadows, one-sided accent borders ("side-tab"), clipped or overflowing content, contrast failures.
- **Widths stay as shipped** per page (`max-w-md` / `sm` / `2xl` / `3xl` / `5xl` / `6xl` / `7xl`). Ignore the generator's 1200px.
- **Icons: lucide only** (already a dependency). No emoji.
- **Protected files** (see `docs/redisign.md`): never touched by any design step.

### 3. Contrast audit of the generated palette (WCAG 2.x, computed)

| Pair | Ratio | Result |
|------|-------|--------|
| foreground `#0F172A` on background `#F0F9FF` / card `#FFFFFF` | 16.75 / 17.85 | pass |
| muted-foreground `#475569` on background / card / muted | 7.11 / 7.58 / 6.99 | pass |
| black on Primary `#0284C7` | 5.13 | pass |
| **white** on Primary `#0284C7` | 4.10 | **fail** |
| black on Accent/CTA `#059669` | 5.57 | pass |
| **white** on Accent/CTA `#059669` (the generated `.btn-primary`) | 3.77 | **fail** |
| white on Destructive `#DC2626` (solid) | 4.83 | pass |
| Destructive text on page background | 4.53 | pass, barely |
| **Destructive text on its own 10% tint** (the tinted Button / Badge variants) over card / page | 4.13 / 3.89 | **fail** |
| **`#0284C7` as text on white** (links) | 4.10 | **fail** |
| **`#059669` as text** on white / page | 3.77 / 3.53 | **fail** |
| **Default Button hover** (`bg-primary/80`) with a white label, on `#059669` / on `#047857` | 2.86 / 3.75 | **fail** |
| Ring `#0284C7` against the page (needs 3:1) | 3.84 | pass |
| **Generated `border` `#E0F0F8`** against white / page (needs 3:1 only for control edges) | 1.17 / 1.10 | fail for controls; acceptable for decorative dividers |
| **Generated `muted` `#EFF7FB`** against the page background | 1.02 | **not perceivable** |

Consequences: the app uses `text-primary` for links, `bg-muted` for the waiting banner, status pill, ghost and outline hover, table-row hover and the FullCalendar neutral background, the tinted destructive variant for the cancel actions, and destructive-coloured text for refund-due amounts. All of those are affected.

### 4. Proposed shadcn token mapping (input to Phase 2b)

**The trap.** The generator's role names do not match shadcn's. In shadcn, `--accent` is the **hover / highlight surface** (ghost and outline hover, menu items); `--primary` is the **default button, selected state, checked native controls (`accent-primary`), `text-primary` links, the FullCalendar active button and today tint**. Mapping "Accent/CTA" to `--accent` mechanically would turn every hover surface green. The CTA colour belongs on `--primary`.

Values are the MASTER hex converted to oklch, so they reproduce the hex exactly in sRGB. Lightness and hue match Tailwind v4's published sky, emerald, slate and red values; chroma is lower because Tailwind defines those colours slightly outside the sRGB gamut. Achromatic colours use hue 0.

| Token | Hex | oklch | Source and note |
|-------|-----|-------|-----------------|
| `--background` | `#F0F9FF` | `oklch(0.977 0.012 237)` | MASTER Background |
| `--foreground` | `#0F172A` | `oklch(0.208 0.040 266)` | MASTER Foreground |
| `--card`, `--popover` | `#FFFFFF` | `oklch(1 0 0)` | MASTER Card |
| `--card-foreground`, `--popover-foreground` | `#0F172A` | same as foreground | |
| `--primary` | `#047857` | `oklch(0.508 0.105 166)` | MASTER Accent/CTA `#059669`, one Tailwind step darker (D1, D2) |
| `--primary-foreground` | `#FFFFFF` | `oklch(1 0 0)` | 5.48:1 on `#047857` |
| `--secondary` | `#0EA5E9` | `oklch(0.685 0.148 237)` | MASTER Secondary, literal. **Unused today**: no page uses a `secondary` Button or Badge. |
| `--secondary-foreground` | `#000000` | `oklch(0 0 0)` | 7.58:1 |
| `--muted` | `#E0F2FE` | `oklch(0.951 0.025 237)` | D3 |
| `--muted-foreground` | `#475569` | `oklch(0.446 0.037 257)` | MASTER |
| `--accent` | = `--muted` | | shadcn hover surface, **not** the CTA colour |
| `--accent-foreground` | = `--foreground` | | |
| `--destructive` | `#B91C1C` | `oklch(0.505 0.190 28)` | D4 |
| `--border` | `#E0F0F8` | `oklch(0.946 0.020 229)` | MASTER Border, literal. Decorative dividers and card edges only. |
| `--input` | `#7A8BA0` | `oklch(0.631 0.037 254)` | D5 |
| `--ring` | `#0284C7` | `oklch(0.588 0.139 242)` | MASTER Primary (brand blue) |
| `--radius` | `0.5rem` | | was `0.625rem`. Gives 8px buttons and inputs and about 11px cards, matching MASTER's component specs (8px / 12px). |
| `--chart-*` | leave | | no chart exists in the app |
| `--sidebar` | `#FFFFFF` | `oklch(1 0 0)` | admin sidebar surface = card white (`pages/admin-shell.md`) |
| `--sidebar-foreground` | `#0F172A` | same as foreground | |
| `--sidebar-primary`, `--sidebar-primary-foreground` | `#047857`, `#FFFFFF` | same as `--primary` | the plain-markup sidebar does not use these; keep them coherent |
| `--sidebar-accent`, `--sidebar-accent-foreground` | = `--muted`, = `--foreground` | | hover surface for nav items |
| `--sidebar-border` | = `--border` | | |
| `--sidebar-ring` | = `--ring` | | |

**Deviations from the generated hex** (each has a measured reason; reverting any one is a one-line change):

- **D1.** `--primary` is the CTA green, not the brand blue. MASTER's own `.btn-primary` and its palette label ("Accent/CTA") both make the CTA green. The brand blue (`#0284C7`) then appears as the focus ring, the "info / waiting" tone, calendar event edges and decorative accents. For any blue **text**, use `#0369A1` (5.93:1 on white). See section 9.
- **D2.** `--primary` `#059669` -> `#047857`. White label 3.77 -> 5.48; link text on white 3.77 -> 5.48; badge text on its tint 3.33 -> 4.78. This is the only change that lets a conventional white button label and `text-primary` links pass AA.
- **D3.** `--muted` `#EFF7FB` -> `#E0F2FE`. Against the page background 1.02:1 -> 1.08:1, so banners, pills and hover rows become visible. Text on it still passes (foreground 15.56, muted-foreground 6.60).
- **D4.** `--destructive` `#DC2626` -> `#B91C1C`. Tinted Button / Badge text 4.13 / 3.89 -> 5.45 / 5.13; solid fill with white text 4.83 -> 6.47. The cancel actions and the refund-due amounts depend on this.
- **D5.** `--input` is a new value: `#7A8BA0`, 3.48:1 against white and 3.27:1 against the page. The generated palette has no input token, and its `.input` border was 1.23:1.

### 5. Fonts

Heading **Poppins**, body **Open Sans** (as generated).

- **Today:** `index.css` line 4 is `@import "@fontsource-variable/geist"` (npm package, self-hosted through Vite). `@theme inline` already defines `--font-heading: var(--font-sans)` and `--font-sans: 'Geist Variable', sans-serif`; `card.tsx` `CardTitle` already uses `font-heading`.
- **Proposed `@theme inline`:** `--font-sans: 'Open Sans Variable', sans-serif` and `--font-heading: 'Poppins', sans-serif` (Google Fonts names would be `'Open Sans'` / `'Poppins'`).
- **Apply headings once:** add `h1, h2, h3 { font-family: var(--font-heading); }` to the existing `@layer base` block, so pages do not need `font-heading` on every heading. Existing structure, no new mechanism.
- **Delivery (needs a decision, section 9):** the generator's `@import url('https://fonts.googleapis.com/...')` is a third-party request on first load, unlike today's self-hosting. Self-hosting the new pair (`@fontsource/poppins`, `@fontsource-variable/open-sans`) needs new dependencies, which changes `package.json` and the lockfile; the guardrails say those are reviewed separately, never inside a visual commit.
- **Weights:** the generator requests Open Sans 300-700 and Poppins 400-700. Request only what the app uses (400, 500, 600; search for `font-bold` before deciding on 700).
- **Unverified:** whether Impeccable's `overused-font` rule flags Poppins or Open Sans. Its engine binary is not installed, so it could not be run. Check at the first `/impeccable critique`.

### 6. Notes for `components/ui` (Phase 2b scope)

- **`button.tsx`**
  - Default hover is `hover:bg-primary/80`, which lightens the fill and drops the white-label contrast to 3.75:1. Make hover **darken** (the `secondary` variant already uses a `color-mix` pattern).
  - Pages use `aria-disabled` (not `disabled`) during requests, but the variants only style `disabled:`. Buttons look fully active while busy. Add `aria-disabled:opacity-50 aria-disabled:cursor-not-allowed` (do not add `pointer-events-none`; the handlers already ignore repeat presses).
  - Sizes are `h-8` (32px), `sm` `h-7`, `lg` `h-9`: below 44px for touch. Add `pointer-coarse:` heights (Tailwind v4) so desktop keeps its density and phones get 44px.
  - The `destructive` variant is tinted. Fine with D4 for the opener. **Irreversible confirmations** (cancel booking, in `BookingPage` and `AdminBookingDetail`) should be solid destructive via a `className` override at those two call sites rather than a new variant.
- **`input.tsx`, `textarea.tsx`:** text is already 16px on mobile (`text-base md:text-sm`). Height is `h-8`: add `pointer-coarse:h-11`. The field is `bg-transparent`, so on the tinted page it shows the page tint: give fields a `bg-card` fill so they read as fields. The border already uses `--input`, so D5 applies automatically.
- **`card.tsx`:** the primitive draws its edge with `ring-1 ring-foreground/10`; the hand-rolled cards on client pages and booking detail use `border`. **Two card looks.** Pick one edge treatment in 2b and make the hand-rolled cards match it in Phase 3. Surface `bg-card`, `rounded-xl`, `p-4`, at most `shadow-sm`.
- **`badge.tsx`:** pages use only `default` (active) and `outline` (every booking status). Statuses need section 7.
- **`checkbox.tsx`, `label.tsx`:** no palette work beyond tokens. Pages mostly use native checkbox / radio with `accent-primary`, which follows `--primary`.
- **`tabs.tsx`:** **no consumers anywhere in the app** (verified by search). Leave untouched; editing it is diff noise.

### 7. Booking status treatments (one system for client, admin and calendar)

The seven statuses today all render as the same plain badge or pill (and in the calendar, identical FullCalendar-blue events). One shared treatment, used by the client booking page pill, the admin list and detail badges and the calendar events. **Proposal: confirm at Section 7 apply and with `/impeccable critique`.**

Rules: the text label is **always** shown; the statuses must stay distinguishable **in greyscale** (fill vs none, solid vs dashed vs dotted edge, a different icon each); text on its own fill is >= 4.5:1; no status uses a 2px destructive edge (reserved for the calendar conflict outline).

| Status | Meaning | Badge / pill | Calendar event | Icon (lucide, `aria-hidden`) |
|--------|---------|--------------|----------------|------------------------------|
| `pending_payment` | unpaid hold | outline, **dashed** edge, foreground text | card fill + **dashed** brand-blue edge | `Clock` |
| `confirmed` | paid, on the calendar | `primary` 10% tint, solid `primary` 30% edge, dark green text | primary tint + solid primary edge | `CircleCheck` |
| `completed` | done | `muted` fill, no edge, foreground text | muted fill + muted-foreground edge | `CheckCheck` |
| `no_show` | client absent | destructive 10% tint, destructive text, no edge | destructive tint + 1px destructive edge | `UserX` |
| `expired` | hold lapsed | no fill, **dotted** edge, muted-foreground text | card fill + dotted muted edge, muted text | `Hourglass` |
| `cancelled_by_client` | cancelled | outline, solid destructive 40% edge, destructive text | card fill + solid destructive 40% edge, muted text | `CircleX` |
| `cancelled_by_admin` | cancelled | outline, solid neutral edge, muted-foreground text | card fill + solid neutral edge, muted text | `Ban` |

Calendar blocks are not a status: muted fill with a diagonal hatch (pattern, not only colour). The dashed cue for `pending_payment` only works because its fill differs from its edge; see `pages/admin-calendar.md`.

### 8. Patterns Bookly really uses (replaces the generated "Funnel")

- **Public pages:** a single centred column, mobile-first at 375px. `max-w-2xl` for flows (pay, progress, my booking), `max-w-5xl` for the list and the service detail. There is no site header or footer; do not add one.
- **The booking funnel** is three progressive groups on one route: Choose (package, add-ons) -> Pick a time -> Your details, then submit -> held -> pay -> progress. Detail in `pages/service-detail.md` and `pages/checkout.md`.
- **Admin:** a navigation **sidebar** from `lg` (15rem, sticky; the same `nav` reflows to a top bar below `lg`), then a per-page `main` that centres in the remaining column with its own width (`7xl` calendar, `6xl` bookings, `5xl` catalogue, `3xl` booking detail). Denser than public pages: use the low end of the spacing scale. Detail in `pages/admin-shell.md`.
- **Card surface:** `bg-card`, `rounded-xl`, `p-4`, one edge treatment (section 6). Only clickable cards get hover.
- **Callout** (non-refundable notice, hold expiry, warnings, the "waiting" banner): tinted fill, full 1px edge, small `aria-hidden` icon. **No left-edge stripe.**
- **Money rows:** label left, amount right, `tabular-nums`; the total is semibold above a `border-t`; an amount is never conveyed by colour alone (its label is always there).
- **Selectable card** (packages, add-ons, payment methods): a label wrapping the native input; selected = tinted fill + ring, not the 1px edge colour alone.
- **Field:** label above; hint below; error below in destructive, linked with `aria-describedby`; 16px text; 44px touch height.
- **Reference numbers** (booking references, payment refs) are monospace and semibold.

### 9. Open decisions (needed before Phase 2b)

1. **Which colour is `--primary`?** Recommended: the CTA green (D1). Alternative: the brand blue. Swapping the two roles changes only the `--primary`, `--primary-foreground` and `--ring` rows of section 4; nothing else moves. This is the largest visible identity choice in the redesign.
2. **AA-safe darker green, or the generated hex?** Recommended: `#047857` (D2). Keeping `#059669` means black button labels (5.57:1) and darker text for links, badges and hover states everywhere `text-primary` is used.
3. **Font delivery.** Self-host through fontsource (recommended: matches today, no third-party request; needs a separate `chore:` commit for `package.json` and the lockfile) or the generator's Google Fonts `@import url(...)` (no dependency change; third-party request; must be the first statement in `index.css`).
4. **Home.** It is an API-health stub, not a landing page (see `pages/home.md`). A real landing page is a separate task with its own copy (`en.json` is protected).
5. **`NotFound` has no way out** (no link home). Adding one needs a string in `en.json`, unless an existing key can be reused.

**Features with no interface** (found by auditing the design files against the backend routes and the spec's permission table). None of these blocks Phase 2b, and none can be built inside the visual-only branch: each needs a new page and new `en.json` copy, which this redesign forbids. They are listed so "no design file" is not mistaken for "no feature".

6. **Admin screens with a backend and no page:** weekly working hours and dated open/close overrides (`/api/admin/working-hours`), availability blocks with the overlap warning (`/api/admin/blocks`), and settings (`/api/admin/settings`: fee rate, minimum notice, hold, buffer, delivery days). Decide whether to build them before Phase 3 section 5 (the admin nav grows from 3 to 5 links and the calendar gains "create a block") or after (they then get their own `pages/*.md` from this file). Recommended: before. The seeded Mon-Fri 09:00-17:00 hours cannot be changed without them.
7. **Calendar events do not open the booking.** There is no `eventClick` or `url` in `AdminCalendar.tsx` or `calendar-events.ts`, so the only way to a booking is the bookings list. `pages/admin-calendar.md` bans popovers and is silent on click-through. Linking a booking event to `/admin/bookings/:id` is a behaviour change, not a styling one.
8. **`/admin/reset-password` is not a route.** The backend's password-reset email links to it (it renders `NotFound`), and the login page has no "Forgot password" link (`pages/admin-login.md` forbids one). Belongs with decision 6.
9. **No way to reach the photographer.** Three client messages say "contact the photographer" (`checkout:closed.body`, `booking:delivery.expired`, `booking:cancel.notCancellable`), but no page shows a phone number, WhatsApp or email. Needs real details from the client and new copy.
