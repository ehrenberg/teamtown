# Coding Guidelines

Clean code at TeamTown means: **a new contributor understands a file without reading five others.**
These rules are binding. Rules marked **(proposal)** still need confirmation.

## 1. General

- **TypeScript strict mode** everywhere. No `any`. Use `unknown` plus narrowing at boundaries.
- **English** for identifiers, comments, commits and docs (ADR-0016).
- **Names reveal intent:** `admitKnockRequest()` rather than `handle()`; `isWalkable` rather than `flag`.
  Use the [ubiquitous language](../architecture/domain-model.md#1-ubiquitous-language-glossary). If a
  concept has no name there, add it to the glossary first.
- **Small units:** functions do one thing. More than ~30 lines or more than 3 parameters is a smell
  (use a parameter object).
- **No magic values:** named constants or configuration.
- **Comments explain *why*, not *what*.** If code needs a *what* comment, rename or extract.
- **No dead code, no commented-out code.** Git remembers.
- **Immutability by default:** `readonly` properties, no mutation of function arguments.
- **Prettier** formats, **ESLint** enforces. CI fails on warnings.

## 2. Domain layer

- Pure TypeScript: no NestJS, MikroORM, LiveKit or HTTP imports. Only `packages/kernel`.
- **Rich model:** behaviour lives on aggregates (`room.changeDoorMode(...)`), not in services that set fields.
- **Invariants are enforced in the aggregate.** An aggregate can never be in an invalid state.
- **Value objects** for concepts with rules (`TileCoord`, `DoorMode`, `Permission`, `ChannelName`).
  Use typed IDs (`PersonId`, `RoomId`) instead of plain strings.
- **Expected failures are values:** return `Result<T, DomainError>` for business rule violations.
  Throw exceptions only for programming errors (broken invariants that "cannot happen").
- Aggregates record **domain events**. The application layer publishes them after a successful commit.
- Time comes from an injected `Clock`, randomness from an injected generator, so everything stays testable.

## 3. Application layer

- One **use case per class/file**: `PostMessage`, `KnockOnRoom`. CQRS-light: commands change state,
  queries return read models. No command returns domain entities.
- Use cases orchestrate: load aggregate → **check permission via `AccessPolicy`** → call domain behaviour
  → save → publish events.
- Depend only on **ports** (interfaces), defined in the same module's `application/ports`.

## 4. Infrastructure & interface layers

- Adapters implement ports. No business rules here.
- Controllers and realtime handlers: validate input (Zod schema from `packages/contracts`) → map to a
  command → call the use case → map the result to a DTO or problem details. Nothing else.
- MikroORM mappings live in `infrastructure/persistence`. Domain classes are never decorated.

## 5. Cross-module communication

- Import other modules **only** through their `public-api.ts`.
- Prefer **domain events** for reactions ("when a room is created, create its wall channel").
- Never read another module's tables. Never share entities across modules.

## 6. Frontend

- **Components are small and dumb by default.** Data fetching and state live in feature hooks.
- **State:** server data via TanStack Query, live world and UI state in Zustand stores (ADR-0020).
- **The world renders state, it doesn't own it.** R3F components receive data from stores. No
  WebSocket calls inside render components.
- **Accessibility is a requirement:** every interactive element is reachable by keyboard and labelled.
  Every world action has a non-spatial path (command palette or list mode).
- **No hard-coded UI strings.** All text goes through i18next catalogues (EN and DE, German with "du").
- Styling only through design tokens (Tailwind theme). No raw hex values in components.
- Icons only from Lucide.
- Native features only via the `PlatformBridge` port. Never `window.electron` directly in features.

## 7. Error handling & logging

- HTTP errors use **RFC 9457 problem details** with a stable `code` (translated in the client).
- Log structured JSON. **Never log positions, message content, tokens or personal data**
  (see [privacy-and-security.md](../architecture/privacy-and-security.md)).

## 8. Dependencies

- New runtime dependencies need a reason in the PR description. Prefer small, maintained,
  **AGPL-compatible** packages (MIT, Apache-2.0, BSD, ISC, MPL-2.0, LGPL; no SSPL, no proprietary).
- A licence check runs in CI (proposal).

## 9. Testing

See [testing-strategy.md](testing-strategy.md). In short: domain logic is test-driven, and every bug fix ships with a regression test.
