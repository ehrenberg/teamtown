# ADR-0030: Server logging (pino) and targeted OpenTelemetry instrumentation

- **Status:** Accepted
- **Date:** 2026-10-30
- **Deciders:** Product owner

## Context

ADR-0019 decided OpenTelemetry traces and metrics plus structured JSON logs, with strict privacy rules
(ADR-0012: no positions, message content, tokens or personal data in telemetry). It left open how logs are
produced and transported, and how broadly the server is instrumented.

## Decision

- **Logs:** We use **pino** via **nestjs-pino** as the Nest logger. Logs are JSON on stdout and are also sent
  via OTLP to the collector → Loki by `@opentelemetry/instrumentation-pino`, which adds `trace_id` and `span_id`.
  Request logs contain only request ID, method, path without query, status and duration; pino redacts
  token, password and auth-header paths as a second line of defence.
- **Instrumentation:** We instrument **selectively**: HTTP (`instrumentation-http`), PostgreSQL
  (`instrumentation-pg`, statement text without parameter values) and pino. HTTP spans are named by route
  template. The realtime gateway has its own spans per command and metrics (`teamtown.realtime.connections`,
  `.commands`, `.command.duration`) whose only attributes are command type and outcome.
- **Privacy in the server:** A span and log processor removes forbidden attributes (client address, user agent,
  query strings, headers, tokens, `teamtown.position/path/target/message*`) before export. The process resource
  detector is not used (it would export the OS user name and command line). The collector drops the same keys
  again as a safety net.
- The SDK starts in `src/instrumentation.ts` (`node --import`) and only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set.

## Alternatives considered

| Option                                                   | Why not                                                                     |
| -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Nest's built-in JSON logger + OTLP                       | Fewer dependencies, but no redaction paths and less control over log fields |
| stdout only, collector reads container logs              | No logs in Loki during local development (`pnpm dev`)                       |
| Full auto-instrumentation (`auto-instrumentations-node`) | Many dependencies; less control over which attributes end up in spans       |

## Consequences

- Positive: logs and traces are correlated; realtime behaviour is visible without personal data.
- Negative: OpenTelemetry JS is in its 3.0 transition (`sdk-trace` replaces `sdk-trace-base`); upgrades need care.
- Follow-ups: Grafana dashboards for the server and WebSocket metrics (ADR-0019); a Dockerfile in M6 must start
  the server with `--import ./dist/instrumentation.js`.
