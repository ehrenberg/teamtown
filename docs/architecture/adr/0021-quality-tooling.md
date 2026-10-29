# ADR-0021: Quality tooling: dependency-cruiser and the test toolchain

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Maintainability is a top quality goal (ADR-0004). Module boundaries and test levels need concrete tooling.

## Decision

- **dependency-cruiser** enforces layer and module boundaries in CI and generates dependency graphs for the docs.
- Test toolchain:
  - **Vitest** for unit, application and integration tests
  - **Testcontainers** (PostgreSQL) for integration tests
  - **Playwright** for E2E tests of the web and Electron apps
  - **k6** for realtime load tests
  - **Postman CLI** collections for REST contract and API tests

## Alternatives considered

| Option | Why not |
|--------|---------|
| eslint-plugin-boundaries | No dependency graphs |
| Jest | Slower, weaker ESM support |

## Consequences

- Postman collections live in the repository and run in CI against the started server.
- See [testing-strategy.md](../../engineering/testing-strategy.md).
