// Bundles the split spec in backend/openapi into one JSON file under public/,
// which the API reference page loads. Runs before dev and build. Uses the
// redocly CLI that ships with @redocly/cli, so there is no extra dependency.
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const specPath = join(root, '..', 'backend', 'openapi', 'openapi.yaml');
const outDir = join(root, 'public');
const outPath = join(outDir, 'openapi.json');

mkdirSync(outDir, { recursive: true });
execFileSync('npx', ['redocly', 'bundle', specPath, '--output', outPath, '--ext', 'json'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
console.log(`openapi.json written to ${outPath}`);
