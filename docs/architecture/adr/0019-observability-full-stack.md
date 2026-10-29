# ADR-0019: Observability with a full stack enabled by default

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

TeamTown is a showcase project, and operational transparency (logs, metrics, traces) is part of what it
demonstrates. Realtime and media issues are hard to debug without traces and metrics.

## Decision

- The server is instrumented with **OpenTelemetry** (traces, metrics) and writes **structured JSON logs**.
- The Docker Compose stack **always** includes **Prometheus, Grafana, Loki and Tempo**, with an
  OpenTelemetry Collector, plus pre-provisioned dashboards (server, WebSocket, LiveKit, PostgreSQL).
- Grafana is only reachable by admins (behind Caddy with authentication).
- **Privacy rules apply to all telemetry:** no positions, message content, tokens or personal data in logs,
  metric labels or span attributes (ADR-0012). Metrics are aggregated, never per person.

## Alternatives considered

| Option                       | Why not                                                           |
| ---------------------------- | ----------------------------------------------------------------- |
| Logs only                    | Too little insight into realtime and media behaviour              |
| Stack as an optional profile | Rejected by the product owner in favour of always-on transparency |

## Consequences

- Higher resource needs: plan **about 1.5–2 GB extra RAM**. The VPS sizing in `deployment.md` reflects this.
- Retention of logs and traces must be bounded (default proposal: 7 days) to limit disk usage.
- An automated test checks that span and log attributes contain no forbidden fields.
