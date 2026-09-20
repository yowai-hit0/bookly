---
name: Bookly
description: A calm, plain-spoken booking front desk for one photographer in Kigali. A sky-tinted page, white cards, one green for the next step and one blue held back for focus.
colors:
  available-green: "oklch(0.5081 0.1049 165.61)"
  available-green-pressed: "oklch(0.4471 0.0923 165.61)"
  calendar-blue: "oklch(0.5876 0.1389 241.97)"
  cancel-red: "oklch(0.5054 0.1905 27.52)"
  cancel-red-tint: "oklch(0.5054 0.1905 27.52 / 10%)"
  morning-sky: "oklch(0.9771 0.0125 236.62)"
  studio-white: "oklch(1 0 0)"
  ink-navy: "oklch(0.2077 0.0398 265.75)"
  slate-text: "oklch(0.4455 0.0374 257.28)"
  powder-blue: "oklch(0.9514 0.0250 236.82)"
  hairline-blue: "oklch(0.9456 0.0201 229.04)"
  field-slate: "oklch(0.6305 0.0374 253.82)"
typography:
  headline:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "normal"
  title:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.3333
    letterSpacing: "normal"
  section:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.5556
    letterSpacing: "normal"
  body:
    fontFamily: "'Open Sans Variable', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.4286
    letterSpacing: "normal"
  label:
    fontFamily: "'Open Sans Variable', sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.4286
    letterSpacing: "normal"
  caption:
    fontFamily: "'Open Sans Variable', sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.3333
    letterSpacing: "normal"
  reference:
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.025em"
rounded:
  sm: "4.8px"
  md: "6.4px"
  lg: "8px"
  xl: "11.2px"
  4xl: "20.8px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.available-green}"
    textColor: "{colors.studio-white}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-primary-hover:
    backgroundColor: "{colors.available-green-pressed}"
  button-outline:
    backgroundColor: "{colors.morning-sky}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  button-outline-hover:
    backgroundColor: "{colors.powder-blue}"
  button-destructive:
    backgroundColor: "{colors.cancel-red-tint}"
    textColor: "{colors.cancel-red}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "0 10px"
  input:
    backgroundColor: "{colors.studio-white}"
    textColor: "{colors.ink-navy}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    height: "32px"
    padding: "4px 10px"
  card:
    backgroundColor: "{colors.studio-white}"
    textColor: "{colors.ink-navy}"
    rounded: "{rounded.xl}"
    padding: "16px"
  badge-active:
    backgroundColor: "{colors.available-green}"
    textColor: "{colors.studio-white}"
    typography: "{typography.caption}"
    rounded: "{rounded.4xl}"
    height: "20px"
    padding: "2px 8px"
  badge-outline:
    textColor: "{colors.ink-navy}"
    typography: "{typography.caption}"
    rounded: "{rounded.4xl}"
    height: "20px"
    padding: "2px 8px"
  link-text:
    textColor: "{colors.slate-text}"
    typography: "{typography.body}"
    height: "24px"
---

# Design System: Bookly

## Overview

**Creative North Star: "The Front Desk"**

Bookly should feel like the front desk of a well-run studio: someone calm at the counter who tells you plainly what is free, what you owe and when, and never oversells. The surfaces stay quiet (a sky-tinted page, white cards with a hairline edge and a whisper of shadow) so that the things that matter, a time, an amount, a status word, are the loudest thing on the screen. Colour appears only when it means something, and it is never the only carrier of meaning.

One system serves two people. Clients book on a phone or a laptop, with no account, usually once. The photographer runs the business from the admin on a desktop. Both get the same tokens and the same primitives; the admin is denser (the low end of the spacing scale), never different in kind. The feel is calm and exact: precise numbers, plain labels, no flourish. Decoration is non-textual (an icon or a dot beside words that already say the thing) and stays small.

Visual rejections recorded in the design system (`design-system/bookly/MASTER.md` section 2; the first three are also enforced by Impeccable's design hook): no gradient text, no glow shadows, no coloured left-edge stripes, no modals, no 3D, parallax or scroll-driven effects, no emoji as icons, and no site header or footer on public pages. The theme is light only; the `.dark` block in `index.css` is unreachable and undesigned.

The palette and the type pairing were chosen by a design tool and accepted by the user. The client has supplied no logo or brand colours yet, so nothing here is brand-derived. If brand colours arrive, they replace Available Green and Calendar Blue in `frontend/src/index.css` and nothing else changes.

**Key Characteristics:**
- Sky-tinted page, white cards, one green for the next step, one blue for focus.
- Poppins for headings, Open Sans for everything else, both self-hosted.
- 32px controls on a mouse, 44px on touch.
- Hairline borders plus `shadow-sm`; no heavy shadows.
- Every status and every amount is written in words; colour and icons only repeat them.

**State of the build (snapshot, 2026-09-20).** Tokens, fonts and the shadcn primitives are shipped and apply app-wide. Only Home and NotFound have their redesigned page layout. Services, checkout, the client booking page and all admin pages are still their pre-redesign layouts wearing the new tokens. What is designed but not built is listed at the end of Components.

## Colors

A cool sky-and-slate ground with one confident green for action and one blue held back for focus. Values are `oklch()` because `frontend/src/index.css` is the source of truth; the sRGB equivalents in parentheses are for reference and were checked to convert with zero error.

### Primary
- **Available Green** (`oklch(0.5081 0.1049 165.61)`, #047857): the next step and the confirmed state. The default Button fill, the active Badge, selected and checked controls, `text-primary` links. White text on it is 5.48:1. It is the CTA green from the generated palette, one Tailwind step darker so a white label passes AA (the generated #059669 gave 3.77:1).
- **Available Green, pressed** (`oklch(0.4471 0.0923 165.61)`): what the default Button turns on hover. The code mixes 12% black into Available Green; this is that result. Hover darkens, because lightening dropped the white label to 3.75:1.

### Secondary
- **Calendar Blue** (`oklch(0.5876 0.1389 241.97)`, #0284C7): where the user is looking or the system is informing. It is the focus ring on every control and the outline on focused text links (3.84:1 on the page). It is never a button fill. The shadcn `--secondary` token (a lighter sky, `oklch(0.6847 0.1479 237.32)`) is defined and used by no page.

### Tertiary
- **Cancel Red** (`oklch(0.5054 0.1905 27.52)`, #B91C1C): cancel actions, errors and refund-due amounts. Text on the page is 6.07:1; on its own 10% tint it is above 5:1. It is a darker red than the generated #DC2626, whose tinted text failed AA (4.13:1).

### Neutral
- **Morning Sky** (`oklch(0.9771 0.0125 236.62)`, #F0F9FF): the page background. Ink on it is 16.75:1.
- **Studio White** (`oklch(1 0 0)`, #FFFFFF): cards, popovers and the fill of every text field, so a field reads as a field on the tinted page.
- **Ink Navy** (`oklch(0.2077 0.0398 265.75)`, #0F172A): all primary text.
- **Slate Text** (`oklch(0.4455 0.0374 257.28)`, #475569): secondary text, hints and back links. 7.11:1 on the page.
- **Powder Blue** (`oklch(0.9514 0.0250 236.82)`, #E0F2FE): the hover and muted surface (ghost and outline hover, table-row hover, banners, disabled fields). It sits only 1.08:1 from the page: a hint, never the sole divider.
- **Hairline Blue** (`oklch(0.9456 0.0201 229.04)`, #E0F0F8): decorative dividers and card edges only. It is far too faint to bound a control.
- **Field Slate** (`oklch(0.6305 0.0374 253.82)`, #7A8BA0): the edge of every input, checkbox and other control (3.48:1 on white, 3.27:1 on the page), so a control's boundary passes the 3:1 non-text rule.

### Named Rules
**The One Green Rule.** Available Green marks the next step and the confirmed state, and nothing else. It is never decoration, and never the fill of a status that is not confirmed.

**The Blue Is For Looking Rule.** Calendar Blue is focus and information. As text on white it is only 4.10:1, so blue text uses #0369A1 (5.93:1); the plain brand blue is for outlines and rings.

**The Words Come First Rule.** Colour never carries a meaning alone. A status dot, a tint or an icon always sits beside the words that state the same thing.

## Typography

**Display Font:** Poppins (with sans-serif), weights 400, 500 and 600.
**Body Font:** Open Sans Variable (with sans-serif), the variable font.
**Label/Mono Font:** the Tailwind default monospace stack, for booking and payment references only.

**Character:** Poppins is round and confident, so titles feel friendly; Open Sans is open and very legible at 14px, which is where most of the app's text lives. Together they read professional but approachable. Both load from the app's own bundle, not from a third party.

### Hierarchy
- **Headline** (600, 1.875rem, 1.2): the title of a client page (Home wordmark, services, service detail, booking, checkout, held).
- **Title** (600, 1.5rem, 1.333): the title of an error, invalid-link or payment-progress state, and of admin pages such as bookings. Two admin pages (calendar and catalogue) currently title at 1.25rem; later sections settle that.
- **Section** (600, 1.125rem, 1.556): every `h2` and card section title ("Price summary"). Fieldset legends ("Choose a package") are the same size and weight but currently render in Open Sans, because only `h1`-`h3` take the heading font; later sections make them match.
- **Body** (400, 0.875rem, 1.429): almost all text. Inputs are 1rem on phones (so iOS does not zoom) and 0.875rem from `md`.
- **Label** (500, 0.875rem): buttons and form labels.
- **Caption** (500, 0.75rem, 1.333): badges, hints and small print.
- **Reference** (mono, 600, 1rem, +0.025em): booking and payment reference numbers, always monospace and semibold so they can be read out or copied without doubt.

### Named Rules
**The Two Voices Rule.** Poppins speaks only in `h1`, `h2`, `h3` and card titles, assigned once in the base layer of `index.css`; a page never adds a heading font by hand. Everything else is Open Sans.

**The Numbers Stay Put Rule.** Amounts, times and counts use tabular figures so columns and totals do not shift as digits change.

## Layout

Mobile first, designed at 375px. Public pages are a single centred column with no site header or footer; each page keeps its own maximum width: `max-w-md` for Home and NotFound, `max-w-2xl` for the flows (pay, progress, my booking), `max-w-5xl` for the service list and detail. Admin pages are denser and each centres in its own width (`3xl` booking detail, `5xl` catalogue, `6xl` bookings, `7xl` calendar).

Spacing follows Tailwind's 4px scale: 8px inside a group (`gap-2`, the most common), 12px (`gap-3`) and 16px (`gap-4`) between related blocks, 16px inside cards (`p-4`), 24px between sections (`gap-6`), 32px of vertical page padding (`py-8`). Breakpoints are Tailwind's (`sm` 40rem, `md` 48rem, `lg` 64rem) and are used lightly; input modality matters more than width, so controls grow to 44px under `pointer-coarse:` and stay 32px otherwise. Stub pages centre vertically with `min-h-svh`. Long unpredictable text (an API error, a name) sits in a shrinkable child with `min-w-0 wrap-anywhere` so it can never force horizontal scroll.

## Elevation & Depth

Tonal layering with a hairline: white cards sit on a sky-tinted page, a Powder Blue surface marks hover, and a 1px border plus one soft shadow lifts the card. There is no scale of large shadows, no blur and no glow; there are no modals to need one.

### Shadow Vocabulary
- **Card lift** (`box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)`): the resting shadow of every card, together with a 1px `border` in Hairline Blue.
- **Focus ring** (`box-shadow: 0 0 0 3px` Calendar Blue at 50%): keyboard focus on buttons, inputs, checkboxes and badges, paired with the control's border turning full Calendar Blue.

### Named Rules
**The Hairline Rule.** A card's edge is a 1px border plus `shadow-sm` and nothing heavier. Extra separation comes from tone (white on sky), never from a bigger shadow.

## Shapes

Everything derives from one `--radius` of 0.5rem: controls are 8px (`rounded-lg`), cards 11.2px (`rounded-xl`), the small button sizes 6.4px, badges fully round pills (`rounded-4xl`), and the checkbox 4px. Edges are 1px: Hairline Blue for decoration, Field Slate for controls. A focus indicator on a text link is a 2px outline offset 2px. Dashed and dotted edges are reserved to mean something (see the designed-not-built statuses below); they are never decorative. Icons are lucide, outline style, 16px beside text (plus one 40px page-level mark on NotFound), and `aria-hidden` whenever they are decorative.

## Components

### Buttons
- **Shape:** 8px radius (`rounded-lg`), 1px transparent border, label in Open Sans medium 14px.
- **Primary (default):** Available Green fill, white label, 10px side padding. Hover darkens to Available Green, pressed. Pressing nudges down 1px.
- **Outline:** Morning Sky fill, Hairline Blue border, Ink Navy label; hover fills Powder Blue. **Ghost:** no fill, Powder Blue on hover. **Destructive:** a tinted button (Cancel Red at 10% fill, Cancel Red label), used for cancel actions; the irreversible confirmations are meant to be a solid Cancel Red fill through a `className` override at the call site, not a new variant. **Secondary and link** variants exist and no page uses `secondary`.
- **Size:** 32px high on a mouse, 44px under `pointer-coarse:` (icon buttons 32px and 44px). The small size also grows to 44px on touch; the extra-small size grows to 36px.
- **Busy and disabled:** pages set `aria-disabled` (not `disabled`) while a request runs, which fades the button to 50% opacity with a not-allowed cursor and keeps it focusable. Native `disabled` fades to 50% and drops pointer events.
- **Focus:** the border turns Calendar Blue with a 3px ring at 50%.

### Inputs / Fields
- **Style:** 8px radius, Field Slate 1px edge, Studio White fill, 32px high (44px on touch), 16px text on phones and 14px from `md`. Textareas match.
- **Focus:** border to Calendar Blue plus a 3px ring at 50%.
- **Error / Disabled:** `aria-invalid` turns the border Cancel Red with a 20% ring; the error text sits below the field in Cancel Red, linked with `aria-describedby`. Disabled fills Powder Blue at 50% opacity.
- **Label and hint:** the label sits above, the hint below; a visible label is never replaced by a placeholder.

### Cards / Containers
- **Corner Style:** 11.2px (`rounded-xl`).
- **Background:** Studio White, with Ink Navy text.
- **Shadow Strategy:** Card lift plus a 1px Hairline Blue border (see Elevation & Depth).
- **Internal Padding:** 16px (`p-4`); a `sm` size uses 12px. The hand-rolled cards on the pages already carry the 1px border but not yet the shadow; Sections 2-4 and 7 add it so there is one card look.

### Badges
- **Style:** a pill, 20px high, caption text, 8px side padding. The active badge is Available Green with white text; the outline badge is a Hairline Blue edge with Ink Navy text (today every booking status renders as the outline badge); a destructive badge is Cancel Red at 10% with Cancel Red text.

### Text link (shipped on NotFound)
- **Style:** a standalone link, not one inside a sentence: Slate Text, 14px, underlined on hover only, with a leading lucide arrow when it means "back". At least 24px high, 44px on touch.
- **Focus:** a full-strength 2px Calendar Blue outline offset 2px. The Button's 50% ring is not used here because it measures about 1.9:1 on the page.

### Status line (shipped on Home)
- **Style:** a small round dot before the words, in Available Green when it worked, Cancel Red when it failed and Slate Text while pending; the text turns Cancel Red on failure and wraps anywhere. The dot repeats what the words say and fades between colours in 200ms, with no transition under reduced motion.

### Designed, not built yet
These are decided in `design-system/bookly/MASTER.md` (sections 7 and 8) and `design-system/bookly/pages/*.md`, and nothing in the app implements them yet:
- **Booking-status treatments:** seven statuses in one shared look (a different edge, fill and lucide icon each, distinguishable in greyscale, with the label always shown), used by the client pill, the admin badges and the calendar events.
- **Callouts:** a tinted fill, a full 1px edge and a small icon, never a left stripe.
- **Selectable cards** (packages, add-ons, payment methods): a tinted fill plus a ring when selected.
- **Money rows:** label left, amount right in tabular figures, total semibold above a `border-t`.
- **Admin sidebar:** 15rem and sticky from `lg`, reflowing to a top bar below it, plus a skip-to-content link. `AdminLayout.tsx` is still the pre-redesign layout.
- **Calendar:** the FullCalendar styling in `index.css` is untouched and still uses the old mapping.

## Do's and Don'ts

### Do:
- **Do** write every status, amount and time in words; let a dot, tint or icon only repeat them.
- **Do** keep controls 32px on a mouse and 44px under `pointer-coarse:`.
- **Do** put keyboard focus in Calendar Blue: a 3px ring at 50% plus a full-strength border on controls, and a 2px full-strength outline offset 2px on text links.
- **Do** set `aria-disabled` on a busy control instead of `disabled`, and fade it to 50%.
- **Do** put unpredictable text (errors, names, references) in a shrinkable child with `min-w-0 wrap-anywhere`.
- **Do** use tabular figures for amounts and times, and monospace semibold for references.
- **Do** reuse existing strings; new decoration is an icon, a dot or a border, not new copy.
- **Do** keep icons to lucide, outline style, with `aria-hidden="true"` when they sit beside words.

### Don't:
- **Don't** use gradient text, glow shadows or a one-sided coloured stripe on a card or callout; they are ruled out in `MASTER.md` section 2 and flagged by Impeccable's design hook.
- **Don't** add modals, 3D, parallax, scroll-driven effects, a site header or footer on public pages, or emoji icons.
- **Don't** use white text on the lighter #059669 green (3.77:1), and don't let a hover state lighten the default Button.
- **Don't** set text in the plain Calendar Blue on white (4.10:1); use #0369A1.
- **Don't** use Hairline Blue or Powder Blue as the only boundary of a control or as the only signal of state.
- **Don't** hard-code a colour, radius or font in a component; use the tokens in `index.css`.
- **Don't** use `bg-input/…` for a disabled fill (the input token is now a mid slate); use Powder Blue.
