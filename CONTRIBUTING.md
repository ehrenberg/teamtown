# Contributing to TeamTown

Thanks for your interest! TeamTown is in **active MVP development**. Start with the
[documentation](docs/README.md), the [roadmap](docs/product/roadmap.md) and the relevant feature spec. If a
change depends on a proposal or an [open question](docs/product/open-questions.md), discuss it with the product
owner before implementation.

## Development setup

```bash
pnpm install     # pnpm 12; downloads Node 24 for this project and installs the Git hooks
pnpm setup:browsers  # once: Chromium for build-time Mermaid diagrams on the website
pnpm stack:up    # backing services in Docker
pnpm dev         # server + web client
pnpm check       # format, lint, types, architecture rules, tokens, tests, licences
```

Commit with `git commit -s`. The hooks format and lint your staged files and check the commit message.

## Before you code

1. Read the [coding guidelines](docs/engineering/coding-guidelines.md), the
   [project structure](docs/engineering/project-structure.md) and the [workflow](docs/engineering/workflow.md).
2. User-facing features need a feature spec (`docs/features/`, template `_template.md`).
3. Architecture changes need an ADR (`docs/architecture/adr/`).

## Non-negotiables

- **Privacy:** never persist or log presence data (positions, paths, room entries). See ADR-0012.
- **Module boundaries:** import other modules only via their `public-api.ts`.
- **Accessibility:** every feature works without the 3D view.
- **i18n:** UI strings in English and German, never hard-coded.
- **Licences:** new dependencies must be AGPL-compatible.

## Pull requests

Small, focused PRs with Conventional Commit titles (`feat(messaging): …`). Fill in the PR checklist
(Definition of Done in [workflow.md](docs/engineering/workflow.md)).

Every commit must be signed off according to the [Developer Certificate of Origin](https://developercertificate.org/)
(`git commit -s`). Contributions are licensed under the AGPL-3.0.

Please follow our [Code of Conduct](CODE_OF_CONDUCT.md). Report security issues privately as described in [SECURITY.md](SECURITY.md).
