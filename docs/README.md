# TeamTown Documentation

> **Project status: planning phase.** No production code exists yet. Decided items are recorded as ADRs.
> Everything else is marked as a proposal and listed in [open questions](product/open-questions.md).

## Product
- [Vision](product/vision.md): problem, idea, principles, audience
- [Brainstorming: idea catalogue](product/brainstorming.md): all feature ideas, rated
- [MVP scope](product/mvp-scope.md)
- [Roadmap](product/roadmap.md)
- [Open questions](product/open-questions.md) ⬅ **decisions needed**

## Architecture
- [Overview (arc42-lite)](architecture/overview.md): quality goals, containers, runtime scenarios
- [Domain model](architecture/domain-model.md): ubiquitous language, bounded contexts, aggregates, events
- [World & realtime](architecture/world-and-realtime.md): tile grid, rendering, path-based movement sync
- [Audio & video](architecture/audio-video.md): LiveKit, proximity audio
- [Permissions](architecture/permissions.md): scoped RBAC
- [Privacy & security](architecture/privacy-and-security.md)
- [Deployment](architecture/deployment.md): VPS + Docker Compose, static site on webhosting
- [Architecture decision records](architecture/adr/README.md)

## Engineering
- [Project structure](engineering/project-structure.md)
- [Coding guidelines](engineering/coding-guidelines.md)
- [Testing strategy](engineering/testing-strategy.md)
- [Workflow, CI & Definition of Done](engineering/workflow.md)
- [Feature spec template](features/_template.md)

## Design
- [Brand guide (CI)](design/brand-guide.md): logo, colours, typography, voice
- [Design system](design/design-system.md): tokens, app shell, components
- [World art direction](design/world-art-direction.md): low-poly style, avatars, asset budgets
- Assets: [`design/brand/`](../design/brand), [`design/tokens/tokens.json`](../design/tokens/tokens.json),
  [interactive mockup `design/mockups/app-shell.html`](../design/mockups/app-shell.html)
