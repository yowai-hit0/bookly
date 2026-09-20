/**
 * Numbers a booking-funnel group's heading with a CSS counter
 * (design-system/bookly/pages/service-detail.md), so the numeral is generated
 * content and no new text exists. The container that holds the groups sets
 * `[counter-reset:step]`; each numbered heading adds this class. The heading's
 * own font (Poppins) carries through to the numeral.
 */
export const stepNumber =
  'before:mr-2 before:inline-flex before:size-6 before:items-center before:justify-center before:rounded-full before:bg-muted before:align-middle before:text-sm before:leading-none before:font-semibold before:content-[counter(step)] before:[counter-increment:step]'
