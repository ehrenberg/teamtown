// Fails if a production dependency has a licence that is not known to be compatible with AGPL-3.0
// (docs/engineering/coding-guidelines.md §8). Usage: pnpm check:licenses
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

/** SPDX identifiers we accept for code that ends up in TeamTown deliverables. */
const ALLOWED = new Set([
  '0BSD',
  'Apache-2.0',
  'BlueOak-1.0.0',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'CC0-1.0',
  'ISC',
  'LGPL-3.0-or-later',
  'MIT',
  'MPL-2.0',
  'OFL-1.1',
  'Python-2.0',
  'Unlicense',
]);

/** Package-specific, documented exceptions: { "<package>": "<reason and decision reference>" }. */
const exceptions = JSON.parse(readFileSync(new URL('./license-exceptions.json', import.meta.url), 'utf8'));

/** Evaluates simple SPDX expressions: "A OR B" needs one allowed term, "A AND B" needs all. */
function isAllowed(expression) {
  const cleaned = expression.replace(/[()]/g, '').trim();
  if (cleaned.includes(' OR ')) return cleaned.split(' OR ').some(isAllowed);
  if (cleaned.includes(' AND ')) return cleaned.split(' AND ').every(isAllowed);
  return ALLOWED.has(cleaned);
}

// Package names and versions come from pnpm itself and only contain npm-safe characters.
const pnpm = (args, options = {}) => execSync(`pnpm ${args}`, { encoding: 'utf8', ...options });

const output = pnpm('licenses list --json --prod --recursive', { maxBuffer: 64 * 1024 * 1024 });
const byLicense = JSON.parse(output);

/**
 * Optional, platform-specific packages (e.g. WASI builds) are not installed locally, so pnpm reports
 * their licence as "Unknown". Ask the registry instead of guessing.
 */
function registryLicense(name, version) {
  try {
    return pnpm(`view ${name}@${version} license`, { stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'Unknown';
  }
}

const violations = [];
for (const [license, packages] of Object.entries(byLicense)) {
  if (isAllowed(license)) continue;
  for (const pkg of packages) {
    if (license === 'Unknown' && pkg.versions.every((version) => isAllowed(registryLicense(pkg.name, version)))) {
      continue;
    }
    if (exceptions[pkg.name]) {
      console.log(`exception  ${pkg.name} (${license}): ${exceptions[pkg.name]}`);
    } else {
      violations.push(`${pkg.name}@${pkg.versions.join(', ')}: ${license}`);
    }
  }
}

if (violations.length > 0) {
  console.error(`Licences not known to be AGPL-compatible:\n  ${violations.join('\n  ')}`);
  console.error('Replace the dependency or record a decision in scripts/license-exceptions.json.');
  process.exit(1);
}
console.log('All production dependency licences are AGPL-compatible.');
