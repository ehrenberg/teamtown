# Development Workflow

Decided: code on **GitHub** under the owner's personal account (`<github-user>/teamtown`), CI/CD with
**GitHub Actions** (ADR-0013), DCO sign-off. Items marked (proposal) are not yet confirmed.

## Branching & commits

- Trunk-based: short-lived branches off `main` (`feat/knock-on-room`, `fix/path-desync`), merged via PR.
- **Conventional Commits:** `feat(meetings): add knock requests`, `fix(world): …`, `docs(adr): …`.
  The scope is the bounded context or package name.
- Squash merge, so the PR title becomes the commit message.
- **DCO sign-off:** every commit carries `Signed-off-by:` (`git commit -s`), per the
  [Developer Certificate of Origin](https://developercertificate.org/). It is checked in CI *(decided)*.

## Pull requests

- Small and focused (guideline: < 400 changed lines excluding generated files).
- The PR template asks for: what and why, screenshots or GIFs for UI, tests, docs and ADR updates,
  i18n (EN + DE), and a privacy impact check ("does this persist or log personal data?").
- At least one approving review. CI must be green.

## Definition of Done

- [ ] Acceptance criteria of the feature spec met
- [ ] Tests at the appropriate level (see testing strategy); all checks green
- [ ] No boundary violations (architecture tests)
- [ ] UI: keyboard-accessible, both languages, uses design tokens, works in list mode
- [ ] Docs updated (feature spec, glossary, ADR if an architecture decision changed)
- [ ] No personal or presence data persisted or logged

## CI pipeline (GitHub Actions)

| Trigger | Jobs |
|---------|------|
| Pull request | install (pnpm, cached) → lint + typecheck → unit + architecture tests → integration tests (Testcontainers) → build (Turborepo affected) → licence check |
| Push to `main` | Everything above + E2E → container images to GHCR → deploy to the showcase VPS (proposal: via SSH action) → build the Astro + Starlight website (landing page + docs) and FTP-deploy it to `teamtown.bastianswelt.de` (ADR-0025) |
| Tag `v*` | Release: container images, Electron builds (Windows, macOS, Linux; unsigned at first, ADR-0025) as GitHub Release |

## Feature workflow

1. Idea in [brainstorming.md](../product/brainstorming.md) → decision by the product owner
2. Feature spec from [docs/features/_template.md](../features/_template.md) (Claude Code: `/feature-spec`)
3. Implementation following the module layout (Claude Code: `/new-module`, `/realtime-message`)
4. PR with DoD checklist
