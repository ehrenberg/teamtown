// Generates packages/ui/src/styles/tokens.css (Tailwind v4 @theme) from design/tokens/tokens.json,
// the single source of truth for design tokens (ADR-0015).
// Usage: node packages/ui/scripts/generate-tokens.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const tokensPath = resolve(here, '../../../design/tokens/tokens.json');
const outputPath = resolve(here, '../src/styles/tokens.css');

const tokens = JSON.parse(readFileSync(tokensPath, 'utf8'));

const isToken = (node) => typeof node === 'object' && node !== null && '$value' in node;

/** Resolves references like "{color.cream}" to their final value. */
function resolveValue(value) {
  if (typeof value !== 'string') return value;
  const match = /^\{(.+)\}$/.exec(value);
  if (!match) return value;
  const target = match[1].split('.').reduce((node, key) => node?.[key], tokens);
  if (!isToken(target)) throw new Error(`Unresolvable token reference ${value}`);
  return resolveValue(target.$value);
}

function flatten(node, path = []) {
  if (isToken(node)) return [{ path, value: resolveValue(node.$value) }];
  return Object.entries(node)
    .filter(([key]) => !key.startsWith('$'))
    .flatMap(([key, child]) => flatten(child, [...path, key]));
}

const cssValue = (value) =>
  Array.isArray(value) ? value.map((part) => (/\s/.test(part) ? `"${part}"` : part)).join(', ') : String(value);

const groups = [
  { title: 'Primitive colours', prefix: 'color', source: tokens.color },
  { title: 'Semantic colours', prefix: 'color', source: tokens.semantic },
  { title: 'Fonts', prefix: 'font', source: tokens.font.family },
  { title: 'Font sizes', prefix: 'text', source: tokens.font.size },
  { title: 'Radii', prefix: 'radius', source: tokens.radius },
  { title: 'Shadows', prefix: 'shadow', source: tokens.shadow },
];

const lines = [
  '/* GENERATED FILE: do not edit. Source: design/tokens/tokens.json. Run `pnpm tokens` to update. */',
  '@theme {',
];
for (const group of groups) {
  lines.push(`  /* ${group.title} */`);
  for (const { path, value } of flatten(group.source)) {
    lines.push(`  --${[group.prefix, ...path].join('-')}: ${cssValue(value)};`);
  }
}
lines.push('}', '');
const css = lines.join('\n');

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(outputPath, 'utf8');
  } catch {
    // missing file is reported below
  }
  if (current !== css) {
    console.error('tokens.css is out of date. Run `pnpm tokens` and commit the result.');
    process.exit(1);
  }
  console.log('tokens.css is up to date.');
} else {
  writeFileSync(outputPath, css);
  console.log(`Wrote ${outputPath}`);
}
