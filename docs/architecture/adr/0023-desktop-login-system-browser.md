# ADR-0023: Desktop login via system browser and deep link

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Product owner

## Context

The Electron app needs to authenticate against Keycloak, which federates company IdPs (Entra ID, Google).

## Decision

Follow **RFC 8252 (OAuth for native apps)**:

1. The desktop app opens the login in the **system browser** (authorization code flow + PKCE).
2. Keycloak redirects to the custom scheme **`teamtown://auth/callback`**.
3. The app exchanges the code for tokens. Refresh tokens are stored with OS-level encryption (Electron `safeStorage`).

## Alternatives considered

| Option | Why not |
|--------|---------|
| Embedded login window | Some IdPs block embedded browsers; weaker support for passkeys and password managers |

## Consequences

- Existing SSO browser sessions, passkeys and password managers work.
- The `teamtown://` protocol is registered on installation and also used for invite links.
