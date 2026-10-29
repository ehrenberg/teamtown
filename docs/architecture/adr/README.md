# Architecture Decision Records

See [ADR-0001](0001-record-architecture-decisions.md) for the process. New ADRs use
[0000-template.md](0000-template.md) (or the `/adr` skill in Claude Code).

| ADR                                                  | Title                                                              | Status   |
| ---------------------------------------------------- | ------------------------------------------------------------------ | -------- |
| [0001](0001-record-architecture-decisions.md)        | Record architecture decisions                                      | Accepted |
| [0002](0002-open-source-agpl-single-tenant.md)       | Open source (AGPL-3.0), self-hostable single-tenant                | Accepted |
| [0003](0003-typescript-monorepo-pnpm-turborepo.md)   | TypeScript monorepo with pnpm + Turborepo                          | Accepted |
| [0004](0004-modular-monolith-ddd-hexagonal.md)       | Modular monolith, DDD, hexagonal (NestJS)                          | Accepted |
| [0005](0005-platforms-web-and-electron.md)           | Web + Electron desktop from day one                                | Accepted |
| [0006](0006-rendering-threejs-r3f.md)                | Three.js / React Three Fiber rendering                             | Accepted |
| [0007](0007-realtime-websocket-messagepack.md)       | Realtime over WebSocket + MessagePack                              | Accepted |
| [0008](0008-audio-video-livekit.md)                  | Audio/video via LiveKit                                            | Accepted |
| [0009](0009-persistence-postgresql-mikroorm.md)      | PostgreSQL + MikroORM                                              | Accepted |
| [0010](0010-identity-oidc-keycloak.md)               | Identity via OIDC with Keycloak                                    | Accepted |
| [0011](0011-authorization-scoped-rbac.md)            | Scoped RBAC                                                        | Accepted |
| [0012](0012-presence-privacy-no-history.md)          | Live presence without history                                      | Accepted |
| [0013](0013-deployment-vps-docker-compose.md)        | VPS + Docker Compose; webhosting static only                       | Accepted |
| [0014](0014-office-editor-tile-grid.md)              | In-app tile-grid office editor                                     | Accepted |
| [0015](0015-ui-radix-tailwind-design-system.md)      | Design system on Radix + Tailwind                                  | Accepted |
| [0016](0016-i18n-english-german.md)                  | i18n with English and German                                       | Accepted |
| [0017](0017-runtime-infrastructure.md)               | Caddy, no Redis in MVP, file storage behind a port                 | Accepted |
| [0018](0018-transactional-outbox.md)                 | Transactional outbox for domain events                             | Accepted |
| [0019](0019-observability-full-stack.md)             | Full observability stack enabled by default                        | Accepted |
| [0020](0020-frontend-state-and-i18n.md)              | Zustand + TanStack Query; i18next                                  | Accepted |
| [0021](0021-quality-tooling.md)                      | dependency-cruiser and test toolchain                              | Accepted |
| [0022](0022-realtime-and-media-topology.md)          | In-process realtime gateway; LiveKit room mapping                  | Accepted |
| [0023](0023-desktop-login-system-browser.md)         | Desktop login via system browser + deep link                       | Accepted |
| [0024](0024-search-postgres-fts-no-telemetry.md)     | PostgreSQL full-text search; no telemetry                          | Accepted |
| [0025](0025-showcase-hosting-and-website.md)         | netcup VPS, hostnames, Astro + Starlight website                   | Accepted |
| [0026](0026-admin-access-and-meeting-logs.md)        | Admins can't read private content; opt-in meeting logs             | Accepted |
| [0027](0027-logged-meeting-consent-and-retention.md) | Explicit consent and retention for logged meetings                 | Accepted |
| [0028](0028-foundation-tooling.md)                   | Foundation tooling (Node 24, pnpm 12, TS 6, ESLint 9, …)           | Accepted |
| [0029](0029-walking-skeleton.md)                     | Walking skeleton (M1): seeds, glTF avatar, OIDC, ws, asset licence | Accepted |
