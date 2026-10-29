# Bounded-context modules

Each bounded context from [docs/architecture/domain-model.md](../../../../docs/architecture/domain-model.md)
lives in its own folder here (`world/`, `presence/`, `meetings/`, `messaging/`, `access/`, …), with the
layout described in [docs/engineering/project-structure.md](../../../../docs/engineering/project-structure.md).

Scaffold new modules with the Claude Code skill `/new-module`. Boundaries are enforced by `pnpm arch`.

`src/platform/` holds cross-cutting infrastructure that is not a bounded context (configuration, health).
