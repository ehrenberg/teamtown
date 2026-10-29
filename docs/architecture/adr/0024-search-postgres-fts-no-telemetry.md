# ADR-0024: Message search with PostgreSQL full-text search; no telemetry

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Messages must be searchable. Self-hosted instances should not send data anywhere.

## Decision

- **Search** uses **PostgreSQL full-text search** (`tsvector` with GIN index, language configurations
  for English and German) behind a `MessageSearch` port in the Messaging module. Results are filtered by
  `AccessPolicy` (only readable channels).
- **No telemetry.** TeamTown instances send no usage data to the project or third parties. There is no opt-in either.

## Alternatives considered

| Option | Why not |
|--------|---------|
| Meilisearch | An additional service in the stack |
| Opt-in telemetry | Not wanted; privacy promise stays absolute |

## Consequences

- No typo tolerance in the MVP. A dedicated search engine can be added behind the port later.
- The project learns about adoption only through voluntary feedback (GitHub, community).
