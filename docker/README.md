# Development stack

`pnpm stack:up` starts the backing services. The TeamTown server and web client run on your machine with `pnpm dev`.

| Service                   | URL                                                 | Credentials (dev only)             |
| ------------------------- | --------------------------------------------------- | ---------------------------------- |
| PostgreSQL                | `localhost:5432` (databases `teamtown`, `keycloak`) | `teamtown` / `teamtown`            |
| Keycloak admin console    | http://localhost:8080/admin                         | `admin` / `admin`                  |
| Keycloak realm `teamtown` | http://localhost:8080/realms/teamtown               | `demo` / `demo`, `demo2` / `demo2` |
| LiveKit                   | `ws://localhost:7880`                               | API key `devkey`, secret `secret`  |
| Grafana                   | http://localhost:3001                               | no login in dev                    |
| Prometheus                | http://localhost:9090                               |                                    |
| Loki                      | http://localhost:3100                               |                                    |
| OTLP (collector)          | `localhost:4317` (gRPC), `localhost:4318` (HTTP)    |                                    |

Retention follows the decisions in `docs/architecture/deployment.md`: logs and traces 7 days, metrics 30 days.

Grafana comes with two provisioned dashboards in the folder **TeamTown** (`observability/dashboards/`):
**TeamTown · Server** (HTTP by route, database client, warnings and errors from Loki) and
**TeamTown · Realtime** (WebSocket connections, commands by type and outcome, handling time).
They are read-only in the UI; change the JSON files instead. Dashboards for LiveKit (M2) and the PostgreSQL
server itself (needs an exporter) follow later.
The OpenTelemetry collector drops presence and message attributes as a privacy safety net (ADR-0012, ADR-0019).

The production Compose setup (Caddy, hostnames, secrets) is part of milestone M6.
