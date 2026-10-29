# Testing Strategy

> Tooling is decided in [ADR-0021](../architecture/adr/0021-quality-tooling.md). Items still marked (proposal) are open.

```
                ▲  E2E (few)            Playwright: web + Electron, critical journeys
               ▲▲▲ Contract             Zod schemas, OpenAPI/AsyncAPI, API collections
             ▲▲▲▲▲ Integration          Module with real PostgreSQL (Testcontainers), LiveKit mocked
          ▲▲▲▲▲▲▲▲ Unit (many)          Domain + application with in-memory adapters (Vitest)
```

| Level | What | Tooling |
|-------|------|------------------|
| **Unit — domain** | Aggregates, value objects, invariants, `world-core` pathfinding. Fast, no I/O. | Vitest |
| **Unit — application** | Use cases with in-memory repositories and a fake `AccessPolicy` | Vitest |
| **Permissions** | Table-driven matrix: actor × assignment × permission × resource → expected | Vitest |
| **Architecture** | Layer and module boundaries, "Presence has no persistence adapter" | dependency-cruiser |
| **Integration** | Repositories, migrations, REST endpoints, realtime gateway with a real WebSocket | Vitest + Testcontainers (PostgreSQL) |
| **Contract** | Realtime messages round-trip through MessagePack + Zod; REST against OpenAPI | Vitest; Postman CLI collections for the REST API (in `postman/`) |
| **Component** | UI components, accessibility checks | Testing Library + axe |
| **Visual** | Design-system components, world snapshots | Storybook + visual regression (proposal) |
| **E2E** | Login → walk → talk → message → knock, in two browsers at once | Playwright (also drives Electron) |
| **Load** | N simulated clients walking and chatting on one floor | k6 |

## Rules

1. **Domain and world-core logic is test-driven.** No PR adds domain behaviour without tests.
2. **Every bug fix includes a regression test** that fails without the fix.
3. **Tests read like specifications:** `it("rejects entering a locked room without invitation")`.
   Use Arrange-Act-Assert and builders/fixtures (`aRoom().locked().build()`).
4. **No sleeping in tests.** Use an injected `Clock` and fake timers.
5. **Realtime tests** use a test client from `packages/contracts` that speaks the real protocol.
6. CI runs unit, architecture, integration and contract tests on every PR. E2E runs on `main` and nightly (proposal).
