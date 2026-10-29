// Copies the repository's docs/ into the Starlight content collection.
// docs/ stays the single source of truth; the generated copy is git-ignored.
//  - adds the `title` frontmatter Starlight requires (taken from the first H1)
//  - turns README.md into index.md
//  - rewrites relative links: docs pages → website routes, everything else → GitHub
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, posix, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '../../..');
const docsRoot = join(repoRoot, 'docs');
const targetRoot = resolve(here, '../src/content/docs/docs');
const assetsTarget = resolve(here, '../src/assets/brand');
const GITHUB_BLOB = 'https://github.com/ehrenberg/teamtown/blob/main/';
const ROUTE_PREFIX = '/docs/';

const toPosix = (path) => path.split(sep).join('/');

function listMarkdown(directory) {
  return readdirSync(directory).flatMap((entry) => {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) return listMarkdown(full);
    // Templates (e.g. adr/0000-template.md, features/_template.md) are for contributors, not readers.
    return entry.endsWith('.md') && !/template\.md$/i.test(entry) ? [full] : [];
  });
}

/** Maps a docs-relative markdown path to its website route. */
function routeFor(docsRelativePath) {
  const withoutExtension = docsRelativePath.replace(/\.md$/i, '');
  const route = withoutExtension.replace(/(^|\/)README$/i, '$1').toLowerCase();
  return ROUTE_PREFIX + route + (route === '' || route.endsWith('/') ? '' : '/');
}

function rewriteLink(target, sourceFile) {
  if (/^([a-z]+:|#|\/)/i.test(target)) return target;
  const [pathPart, anchor] = target.split('#');
  const absolute = resolve(dirname(sourceFile), pathPart);
  const suffix = anchor ? `#${anchor}` : '';
  const insideDocs = !relative(docsRoot, absolute).startsWith('..');
  if (insideDocs && absolute.endsWith('.md')) {
    return routeFor(toPosix(relative(docsRoot, absolute))) + suffix;
  }
  return GITHUB_BLOB + toPosix(relative(repoRoot, absolute)) + suffix;
}

function convert(sourceFile) {
  const content = readFileSync(sourceFile, 'utf8');
  const heading = /^#\s+(.+)$/m.exec(content);
  const title = (heading?.[1] ?? 'Untitled').replace(/`/g, '').trim();
  const body = (heading ? content.replace(heading[0], '') : content).replace(
    /\]\(([^)\s]+)\)/g,
    (_, target) => `](${rewriteLink(target, sourceFile)})`,
  );
  return `---\ntitle: ${JSON.stringify(title)}\n---\n${body.replace(/^\s*\n/, '')}`;
}

rmSync(targetRoot, { recursive: true, force: true });
for (const sourceFile of listMarkdown(docsRoot)) {
  const docsRelative = toPosix(relative(docsRoot, sourceFile)).replace(/(^|\/)README\.md$/i, '$1index.md');
  const targetFile = join(targetRoot, ...posix.normalize(docsRelative).split('/'));
  mkdirSync(dirname(targetFile), { recursive: true });
  writeFileSync(targetFile, convert(sourceFile));
}

mkdirSync(assetsTarget, { recursive: true });
cpSync(join(repoRoot, 'design/brand'), assetsTarget, { recursive: true });
console.log(`Synced docs/ into ${toPosix(relative(repoRoot, targetRoot))}`);
