# Development Workflow

Decided: code on **GitHub** under the owner's personal account ([`ehrenberg/teamtown`](https://github.com/ehrenberg/teamtown)), CI/CD with
**GitHub Actions** (ADR-0013), DCO sign-off. Items marked (proposal) are not yet confirmed.

## Branching & commits

- Trunk-based: short-lived branches off `main` (`feat/knock-on-room`, `fix/path-desync`), merged via PR.
  The owner's own work merges into `main` after every finished task, by fast-forward and without a PR; contributions
  from others go through a PR.
- **Conventional Commits:** `feat(meetings): add knock requests`, `fix(world): …`, `docs(adr): …`.
  The scope is the bounded context or package name.
- Squash merge, so the PR title becomes the commit message.
- **DCO sign-off:** every commit carries `Signed-off-by:` (`git commit -s`), per the
  [Developer Certificate of Origin](https://developercertificate.org/). It is checked in CI _(decided)_.

## Pull requests

- Small and focused (guideline: < 400 changed lines excluding generated files).
- The PR template asks for: what and why, screenshots or GIFs for UI, tests, docs and ADR updates,
  i18n (EN + DE), and a privacy impact check ("does this persist or log personal data?").
- At least one approving review. CI must be green.

## Review before a PR

The review instance is local and advisory ([ADR-0037](../architecture/adr/0037-pr-review-with-ponytail.md)):

1. Run `/pr-review` in Claude Code on the finished branch. It runs the CI checks, Ponytail's review and the TeamTown
   rules, and ends with a verdict.
2. Fix the **Must fix** findings, and decide on the rest.
3. Note the verdict in the PR description. The human review follows as usual.

Without Claude Code, go through the rules in section 4 of `.claude/skills/pr-review/SKILL.md` by hand.

**Ponytail** is enabled for this repository in `.claude/settings.json`, pinned to a release, at level `lite`: Claude Code
asks once to trust it. To update it, read what the new release's hooks do, change `ref` and commit that. To opt out,
set `"ponytail@ponytail": false` in your `.claude/settings.local.json`.

## Definition of Done

- [ ] Acceptance criteria of the feature spec met
- [ ] Tests at the appropriate level (see testing strategy); all checks green
- [ ] No boundary violations (architecture tests)
- [ ] UI: keyboard-accessible, both languages, uses design tokens, works in list mode
- [ ] Docs updated (feature spec, glossary, ADR if an architecture decision changed)
- [ ] No personal or presence data persisted or logged
- [ ] `/pr-review` ran, and its Must fix findings are resolved

## CI pipeline (GitHub Actions)

| Trigger        | Jobs                                                                                                                                                                                                                             |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pull request   | install (pnpm, cached) → lint + typecheck → unit + architecture tests → integration tests (Testcontainers) → build (Turborepo affected) → licence check                                                                          |
| Push to `main` | Everything above + E2E → container images to GHCR → deploy to the showcase VPS (proposal: via SSH action) → build the Astro + Starlight website (landing page + docs) and FTP-deploy it to `teamtown.bastianswelt.de` (ADR-0025) |
| Tag `v*`       | Release: container images, Electron builds (Windows, macOS, Linux; unsigned at first, ADR-0025) as GitHub Release                                                                                                                |

## Feature workflow

1. Idea in [brainstorming.md](../product/brainstorming.md) → decision by the product owner
2. Feature spec from [docs/features/_template.md](../features/_template.md) (Claude Code: `/feature-spec`)
3. Implementation following the module layout (Claude Code: `/new-module`, `/realtime-message`)
4. `/pr-review`, then a PR with DoD checklist
