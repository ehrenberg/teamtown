# ADR-0010: Identity via OIDC with Keycloak

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

Companies want SSO with their existing identity provider (Entra ID, Google Workspace, LDAP).
Small companies and the showcase need simple local accounts. TeamTown should never handle passwords.

## Decision

- **Keycloak** is part of the stack as the OIDC provider. It federates external IdPs and provides local
  accounts, MFA and passkeys.
- Clients use the **authorization code flow with PKCE**. The server validates access tokens via JWKS.
- The Identity module only maps the OIDC `sub` to a `Person`. Profile data lives in People.

## Alternatives considered

| Option                             | Why not                                     |
| ---------------------------------- | ------------------------------------------- |
| Managed IdP (Auth0, Zitadel Cloud) | External dependency and per-user cost       |
| Entra ID only                      | Excludes non-Microsoft companies            |
| Custom authentication              | Security risk; SSO would need to be rebuilt |

## Consequences

- Keycloak (Java) adds memory footprint to the stack.
- A pre-configured realm export ships with the Compose setup.
- Keycloak is Apache-2.0 licensed, which is compatible with AGPL.
