# Permissions Model (Scoped RBAC)

Decided: **scoped role-based access control** ([ADR-0011](adr/0011-authorization-scoped-rbac.md)).
The permission and role catalogue below is decided (P-33, [ADR-0036](adr/0036-govern-milestone-rules.md)).

## 1. Concepts

```
Permission   = an atomic capability          e.g. "message.post"
Role         = a named set of permissions    e.g. "Channel Moderator"
Scope        = where something applies       town ▸ floor ▸ room   |   town ▸ channel
Assignment   = (principal, role, scope)      principal = person or group
```

**Evaluation:** `can(person, permission, resource)` is _true_ if any role assigned to the person
(directly or via a group) **at the resource's scope or any parent scope** contains the permission.

**Inheritance and privacy:** Permissions are inherited downwards (town → floor → room, town → channel).
A resource marked **private** (private channel, `locked` room) **stops inheritance** of _access_
permissions (`*.read`, `room.enter`). Only explicit assignments or memberships at that resource grant
access. Town admins can still _manage_ (rename, archive), but cannot read private content.
This rule is decided ([ADR-0026](adr/0026-admin-access-and-meeting-logs.md)): no permission and no break-glass mechanism grants reading private content.

**No explicit deny.** Only grants exist, which keeps the model explainable: "Why can Ben do X?" always has a positive answer listing the granting assignments.

## 2. Permission catalogue

| Area      | Permissions                                                                                                                                                                                                                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Town      | `town.manage`, `town.members.invite`, `town.members.manage`, `town.roles.manage`, `town.audit.read`                                                                                                                            |
| World     | `world.view`, `world.edit` (editor), `room.enter`, `room.admit` (answer knocks), `room.lock` (change door mode), `room.policy.manage`, `desk.claim`, `desk.assign`                                                             |
| Meetings  | `meeting.log.start`, `call.join`, `call.speak`, `call.video`, `call.screenshare`, `call.mute.others`, `call.remove.others`, `floor.announce` (megaphone, later)                                                                |
| Messaging | `channel.create.public`, `channel.create.private`, `channel.read`, `channel.manage`, `message.post`, `message.post.announcement`, `message.edit.own`, `message.delete.own`, `message.delete.any`, `message.pin`, `file.upload` |
| Direct    | `dm.start`, `call.direct`                                                                                                                                                                                                      |

## 3. Built-in roles

| Role                  | Typical scope  | Contains (summary)                                                                                                                                                                                                                    |
| --------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Owner**             | town           | everything, cannot be removed (at least one owner)                                                                                                                                                                                    |
| **Admin**             | town           | everything except ownership transfer                                                                                                                                                                                                  |
| **Member**            | town           | world view, enter rooms, switch doors and answer knocks from inside, start logged meetings, calls, DMs, post in readable channels, create public and private channels, claim desk; everyone but guests holds it without an assignment |
| **Guest**             | room / channel | enter the shared room, join its call, read and post in the shared channel; can only reply to DMs that members start _(decided)_                                                                                                       |
| **Room Host**         | room           | `room.admit`, `room.lock`, `meeting.log.start`, `call.mute.others`, `call.remove.others`                                                                                                                                              |
| **Channel Moderator** | channel        | `channel.manage`, `message.delete.any`, `message.pin`                                                                                                                                                                                 |
| **Editor**            | town or floor  | `world.edit`                                                                                                                                                                                                                          |

Admins can create **custom roles** by composing permissions, for example "Team Lead" = Room Host +
Channel Moderator for the team's floor.

## 4. Implementation

```
modules/access/
  domain/          Role, RoleAssignment, Permission (value object), Scope
  application/     AccessPolicy (port implementation), role management use cases
  infrastructure/  MikroORM repositories, permission cache
  public-api.ts    exports only: AccessPolicy interface, Permission constants, ScopeRef
```

- Other modules depend **only** on the `AccessPolicy` port:
  `can(personId, permission: Permission, resource: ScopeRef): Promise<boolean>`. A `filterVisible` for lists
  follows when a list needs it (M4d).
- Built-in roles live in code; custom roles and their tables arrive with M4b.
- Reading still goes through memberships and `Channel.canRead`; M4d moves it to `AccessPolicy`, when guests need it.
- Checks happen in **application services** (use cases), never in controllers or the domain.
  Domain objects stay pure.
- **Caching:** effective permissions per person and scope are cached in memory and invalidated on
  `RoleAssigned`, `RoleRevoked` and `RoleChanged`.
- **Realtime:** the WebSocket gateway uses the same `AccessPolicy` for every command. Presence
  re-checks `room.enter` on room transitions.
- **Testing:** a table-driven test suite ("person X with assignments Y can/cannot do Z on resource W")
  documents and verifies the model.
