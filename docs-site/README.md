# Bookly documentation site

The [VitePress](https://vitepress.dev) site that publishes Bookly's
documentation. This release ships the **developer guide** and the **API
reference**; a photographer's guide and a client help centre, in English and
French, are planned follow-ups.

## Develop

```sh
npm install
npm run dev        # bundles the OpenAPI spec, then serves the site
```

## Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Bundle the spec and run the dev server. |
| `npm run build` | Bundle the spec and build the static site to `.vitepress/dist/`. |
| `npm run preview` | Serve the built site. |
| `npm run bundle-openapi` | Bundle `../backend/openapi` into `public/openapi.json`. |
| `npm run api:lint` | Lint the backend OpenAPI spec with Redocly. |

## How the API reference works

The source of truth is the hand-written spec at
[`../backend/openapi/openapi.yaml`](../backend/openapi/openapi.yaml), kept honest
by a backend test (`src/openapi.test.ts`). `scripts/bundle-openapi.mjs` bundles
its split files into `public/openapi.json`, and `api/index.md` renders that with
[Scalar](https://github.com/scalar/scalar). The "send request" button is turned
off on purpose: the docs must never fire calls at the live API, where a payment
attempt would prompt a real phone and a booking would hold a real slot.

`public/openapi.json` is generated — it is git-ignored and rebuilt on every
`dev`/`build`.

## Structure

- `index.md` — landing page.
- `developers/` — the developer guide (architecture, setup, data model, booking
  lifecycle, payments, outbox, auth, testing).
- `api/` — `index.md` (the reference) and `conventions.md`.
- `.vitepress/config.ts` — site config, navigation and sidebar.
- `.vitepress/theme/` — the default theme plus the `ApiReference` component.
- `scripts/` — the spec bundler.
