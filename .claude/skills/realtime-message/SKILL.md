---
name: realtime-message
description: Add or change a TeamTown realtime WebSocket message (client command or server event) contract-first with Zod schemas in packages/contracts, AsyncAPI docs, server handler and client handling. Use for presence, movement, meetings, knock or live-notification messages.
---

# Add a realtime message (contract-first)

Background: `docs/architecture/world-and-realtime.md` §5 and ADR-0007.
Envelope `{ t, id?, p }`, MessagePack-encoded.

## Naming

- **Commands** (client → server): imperative, e.g. `MoveTo`, `KnockOnRoom`, `SetStatus`.
- **Events** (server → client): past tense or state change, e.g. `AvatarPathStarted`, `KnockRequested`.
- Payloads carry IDs and minimal data. **Never** include data the receiver isn't allowed to see (e.g. no
  names of people inside a locked room).

## Steps

1. **Contract:** add the Zod schema to `packages/contracts/src/realtime/<context>.ts` and register it in
   the command or event union. Use shared primitives (`TileCoord`, typed IDs). Payload fields are optional only when truly optional.
2. **Docs:** regenerate or update the AsyncAPI document and mention the message in the related feature spec.
3. **Server:** add a handler in `apps/server/src/modules/<context>/interface/realtime/`. It validates the
   payload (the schema already parsed it), maps it to an application command, and replies `Ack{id}` or
   `Nack{id, code}`. Authorization happens in the use case through `AccessPolicy`.
4. **Broadcast scope:** decide who receives events (same floor, room occupants, single person) and
   check the decision against `docs/architecture/permissions.md`.
5. **Client:** handle it in `apps/web/src/realtime/` and update stores. Render components react to store changes only.
6. **Tests:**
   - a contract round-trip test (encode → decode → schema parse)
   - a server handler or use case test, including an unauthorized case
   - for movement: deterministic interpolation test in `packages/world-core`
7. **Breaking change?** If an existing message changes incompatibly, bump the protocol version and
   keep the old version until clients are updated.

## Privacy check

If the message carries positions or presence, make sure it is **not** logged or persisted anywhere (ADR-0012).
