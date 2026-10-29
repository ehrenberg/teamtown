// Verifies that every commit in a range carries a DCO sign-off (CONTRIBUTING.md).
// Usage: node scripts/check-dco.mjs <base-ref> [head-ref]
import { execFileSync } from 'node:child_process';

const [base, head = 'HEAD'] = process.argv.slice(2);
if (!base) {
  console.error('Usage: node scripts/check-dco.mjs <base-ref> [head-ref]');
  process.exit(2);
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const commits = git('rev-list', '--no-merges', `${base}..${head}`).split('\n').filter(Boolean);
const unsigned = commits.filter((sha) => {
  const author = git('show', '-s', '--format=%ae', sha);
  const body = git('show', '-s', '--format=%B', sha);
  return !body.split('\n').some((line) => line.startsWith('Signed-off-by:') && line.includes(author));
});

if (unsigned.length > 0) {
  console.error('Commits without a DCO sign-off matching the author (use `git commit -s`):');
  for (const sha of unsigned) console.error(`  ${git('show', '-s', '--format=%h %s', sha)}`);
  process.exit(1);
}
console.log(`All ${commits.length} commit(s) are signed off.`);
