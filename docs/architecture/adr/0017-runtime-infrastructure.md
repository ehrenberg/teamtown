# ADR-0017: Runtime infrastructure: Caddy, no Redis, file storage behind a port

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

The Docker Compose stack must stay simple for self-hosters (single tenant, 50–500 people, one server
process) while leaving room to grow.

## Decision

- **Reverse proxy: Caddy**, with automatic HTTPS via Let's Encrypt. It routes to the web client, server
  (REST + WebSocket) and Keycloak.
- **No Redis in the MVP.** One server process holds presence in memory and uses an in-process event bus.
  Redis is added when horizontal scaling becomes necessary.
- **File storage behind a `FileStorage` port.** The default adapter is a **local Docker volume**. An
  **S3-compatible adapter** is an optional alternative (configured via environment variables).

## Alternatives considered

| Option | Why not |
|--------|---------|
| Traefik | Label-based configuration is more complex for self-hosters |
| nginx | TLS certificates need separate handling (certbot) |
| Redis from day one | An additional service without a current need |
| Always MinIO | An additional service; volumes are enough for the target size |
| Files in PostgreSQL | Bad for backups and performance |

## Consequences

- Backups must include the PostgreSQL dumps **and** the file volume.
- Scaling beyond one server process requires Redis (pub/sub, presence) and S3 storage. Both are
  prepared by ports, so no domain changes are needed.
