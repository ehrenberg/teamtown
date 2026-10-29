# Contributing to TeamTown

Thanks for your interest! TeamTown is in its **planning phase**. The most valuable contributions right now
are feedback on the [docs](docs/README.md), especially the [open questions](docs/product/open-questions.md)
and the [idea catalogue](docs/product/brainstorming.md).

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
