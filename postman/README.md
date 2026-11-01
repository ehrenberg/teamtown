# Postman collections

Contract tests for the REST API of the TeamTown server, in the Git-native Postman v3 format
(one YAML file per request). Realtime messages are tested with Vitest, the UI with Playwright
(`docs/engineering/testing-strategy.md`).

| Path                                  | Content                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `collections/TeamTown API/`           | `/api/health`, `/api/me`, `/api/floors`, floor plans, `/api/meeting-logs`, `/api/people`, channels, DMs |
| `environments/Local.environment.yaml` | Local dev stack (`pnpm stack:up` + `pnpm dev`)                                                          |

## Run

```bash
pnpm stack:up   # Keycloak, PostgreSQL
pnpm dev        # server on :3000
pnpm api:test   # needs the Postman CLI (no login required for local runs)
```

## Authentication

The collection fetches access tokens for the demo users `demo` and `demo2` itself (collection pre-request script) from
the client `teamtown-api-tests` of the dev realm. Only this client allows the password grant, and it
exists **only** in `docker/keycloak/realm-teamtown.json`, never in production.

Keycloak imports the realm only into a fresh database. If your stack is older than this client, add it
in the admin console (http://localhost:8080/admin, `admin` / `admin`) or recreate the Keycloak
database.

## Test data

The messaging requests run as `demo`, with `demo2` as the colleague for invitations and DMs. Each run
creates a private channel `api-test-…`, archives it and makes both users leave it, so it shows up in
nobody's list. The 1:1 DM between the two demo users is opened, not created anew, on every run.

## Conventions

- Assertions follow the Zod contracts in `packages/contracts`; change both together.
- Every endpoint gets a success case and its documented failure cases (401, 404, ...).
- No real credentials in committed files; only the public dev demo user.
