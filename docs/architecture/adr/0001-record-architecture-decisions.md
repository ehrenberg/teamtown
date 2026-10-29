# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

TeamTown is an open-source project that other developers should be able to join. Decisions and
their reasons must be traceable without asking the original authors.

## Decision

We record every significant architecture decision as an ADR in `docs/architecture/adr/`, using
[0000-template.md](0000-template.md). ADRs are immutable once accepted. A changed decision gets a new
ADR that supersedes the old one. Undecided topics are tracked in
[open-questions.md](../../product/open-questions.md), not as accepted ADRs.

## Consequences

- Newcomers can understand *why* things are the way they are.
- A PR that changes a decided architecture aspect must include a new ADR.
