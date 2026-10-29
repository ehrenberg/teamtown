# ADR-0013: Showcase on a VPS with Docker Compose; webhosting for static content only

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

The owner has a classic webhosting plan (PHP + MySQL, FTP, no SSH). TeamTown requires long-running
processes (Node.js, Keycloak, LiveKit), WebSockets and UDP ports, and classic hosting provides none of these.

## Decision

- Keep the architecture as designed. The **showcase instance runs on a small VPS** with **Docker Compose**.
- The **webhosting serves static content only** (landing page, documentation), deployed via FTP(S) from CI.
- Code hosting and CI/CD: **GitHub + GitHub Actions**; container images on GHCR.

## Alternatives considered

| Option                                                          | Why not                                       |
| --------------------------------------------------------------- | --------------------------------------------- |
| Two operating modes (full + PHP "lite")                         | Two backends to maintain                      |
| Re-architecture for PHP hosting with external realtime/A/V SaaS | Vendor dependence; reverses earlier decisions |
| Static frontend-only demo                                       | No real product running                       |

## Consequences

- Small monthly VPS cost.
- The showcase and company self-hosting use the same path, so the showcase proves self-hostability.
