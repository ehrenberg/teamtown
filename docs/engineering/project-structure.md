# Project Structure

> Implemented in M0 (ADR-0028). Folders marked **(planned)** follow with later milestones.

```
teamtown/
├── apps/
│   ├── server/              NestJS modular monolith (REST + realtime gateway)
│   ├── web/                 React web client (UI chrome + R3F world)
│   ├── desktop/             Electron shell around apps/web
│   └── website/             Astro + Starlight: landing page + docs (static, deployed to the webhosting)
├── packages/
│   ├── contracts/           Zod schemas: REST DTOs + realtime messages (single source of truth)
│   ├── world-core/          Framework-free world maths: grid, iso projection, A* pathfinding, walls
│   ├── kernel/              Shared kernel: Result, typed IDs, DomainEvent/AggregateRoot, Clock
│   ├── ui/                  Design-system components (Radix + Tailwind)
│   ├── i18n/                i18next message catalogues EN/DE
│   └── config/              Shared tsconfig, ESLint, Prettier, Tailwind preset
├── design/
│   ├── brand/               Logo files (SVG)
│   ├── tokens/              Design tokens (tokens.json), source for Tailwind and CSS variables
│   └── mockups/             HTML/SVG design mockups
├── docs/                    Product, architecture (incl. ADRs), engineering, design
├── docker/                  Compose files, Caddyfile, Keycloak realm, LiveKit and observability config
├── postman/                 Postman CLI collections for REST API tests (planned, M1)
├── scripts/                 Repository checks: licences, DCO sign-off
├── .claude/skills/          Project skills for Claude Code
├── .github/                 Workflows, issue and PR templates
├── CLAUDE.md
└── LICENSE                  AGPL-3.0
```

## Server module layout (`apps/server/src/modules/<context>/`)

Every bounded context ([domain-model.md](../architecture/domain-model.md)) has the same shape:

```
modules/messaging/
├── domain/                  Pure TS. Entities, value objects, domain events, domain services.
│   ├── channel.ts           No imports from NestJS, MikroORM or other modules.
│   ├── message.ts
│   └── events.ts
├── application/             Use cases (commands/queries) and ports (interfaces)
│   ├── commands/post-message.command.ts
│   ├── queries/list-channel-messages.query.ts
│   └── ports/message-repository.port.ts
├── infrastructure/          Driven adapters: MikroORM mappings and repositories, external clients
│   └── persistence/
├── interface/               Driving adapters: REST controllers, realtime handlers, event subscribers
│   ├── http/
│   └── realtime/
├── messaging.module.ts      NestJS wiring (the only place that knows all layers)
└── public-api.ts            What other modules may import (facade interface, event types, IDs)
```

### Dependency rules (enforced by lint and architecture tests)

```
interface ──▶ application ──▶ domain
infrastructure ──▶ application (implements ports) ──▶ domain
domain ──▶ (nothing except packages/kernel)
module A ──▶ module B: only via B/public-api.ts or B's domain events
apps/web ──▶ packages/* ; never ──▶ apps/server
packages/world-core, contracts, kernel ──▶ no framework dependencies
```

## Web client layout (`apps/web/src/`) — proposal

```
app/            Bootstrapping, routing, providers
features/       Vertical feature slices: messaging/, meetings/, presence/, editor/, admin/
world/          R3F scene, camera, avatar rendering, world objects (render only)
realtime/       WebSocket client, MessagePack codec, reconnect, clock sync; feeds Zustand stores
stores/         Zustand stores for live world and UI state (server data: TanStack Query in features)
media/          LiveKit client adapter, spatial audio
platform/       PlatformBridge port + web implementation (desktop impl lives in apps/desktop)
shared/         Hooks and utils without feature knowledge
```

Features may use `shared/`, `world/` and `realtime/`, but not each other's internals.
