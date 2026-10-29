# ADR-0002: Open source under AGPL-3.0, self-hostable single-tenant product

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

TeamTown should be open source and serve as a public showcase project. An earlier preference for
"SaaS only" was replaced by this decision. Companies (50–500 people) should be able to run it themselves.

## Decision

- License: **GNU AGPL-3.0** (see `LICENSE`).
- Operating model: **self-hostable, single-tenant** (one instance = one company, a "Town").
  The project owner runs a public **showcase instance**.
- No multi-tenancy in the domain model.

## Alternatives considered

| Option | Why not |
|--------|---------|
| MIT / Apache-2.0 | Allow closed SaaS forks without giving back |
| MPL-2.0 | Weaker protection for network use |
| Multi-tenant OSS | Significant complexity (tenant isolation everywhere) without a current need |

## Consequences

- Anyone offering a modified TeamTown over a network must publish their changes.
- Simpler domain and data model (no tenant IDs).
- Third-party dependencies must have AGPL-compatible licences (checked in CI).
