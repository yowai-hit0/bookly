// Builds the API reference assets under public/, from the split spec in
// backend/openapi. Runs before dev and build. Two outputs:
//   - api-reference.html: a standalone Redoc page (the reference the site shows)
//   - openapi.json: the bundled spec, offered as a raw download
// Both come from the redocly CLI that ships with @redocly/cli, so there is no
// extra dependency.
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const specPath = join(root, '..', 'backend', 'openapi', 'openapi.yaml')
const outDir = join(root, 'public')

mkdirSync(outDir, { recursive: true })

const redocly = (args) =>
  execFileSync('npx', ['redocly', ...args], { stdio: 'inherit', shell: process.platform === 'win32' })

// The rendered reference. The standard Redoc theme is the look we want; we only
// hide the redundant "download" button (the spec is linked separately) and
// expand the success responses. Flag values are kept free of spaces so they
// survive the shell on every platform.
redocly([
  'build-docs',
  specPath,
  '--output', join(outDir, 'api-reference.html'),
  '--theme.openapi.hideDownloadButton=true',
  '--theme.openapi.expandResponses=200,201',
])

// The raw spec, for callers who want to import it.
redocly(['bundle', specPath, '--output', join(outDir, 'openapi.json'), '--ext', 'json'])

console.log('api-reference.html and openapi.json written to', outDir)
