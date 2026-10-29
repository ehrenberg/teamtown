# Design System

Decided: Radix primitives + Tailwind, tokens as the single source ([ADR-0015](../architecture/adr/0015-ui-radix-tailwind-design-system.md)).
The layout and component list are a **proposal**. See the clickable mockup:
[`design/mockups/app-shell.html`](../../design/mockups/app-shell.html) (open it in a browser).

## 1. Tokens

`design/tokens/tokens.json` follows the [W3C Design Tokens](https://design-tokens.github.io/community-group/format/)
format. It will be transformed (proposal: Style Dictionary) into:

- CSS custom properties (`--tt-color-terracotta-500`), used by Tailwind and the world renderer's UI overlays
- a Tailwind preset in `packages/config`
- TypeScript constants for the 3D material palette

Layers: **primitive** tokens (`terracotta.500`) → **semantic** tokens (`color.action.primary`,
`color.surface.canvas`, `color.status.available`). Components only use semantic tokens. This makes a
dark theme (and later company theming) a token swap.

## 2. App shell layout

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ [logo] TeamTown · Acme GmbH   [⌘K Search / go to / call …]   [status ▾] [me] │  top bar
├────┬───────────────┬──────────────────────────────────────┬──────────────────┤
│ 🏢 │ ROOMS         │                                      │ Context panel    │
│ #  │  Kitchen  ●●● │        isometric office (R3F)        │ – room wall chat │
│ ✉  │  Elbe 🔒  ●●  │                                      │ – conversation   │
│ 📅 │ CHANNELS      │   [floor ▾]               [minimap]  │ – thread         │
│ ⚙  │  # general    │                                      │ – person profile │
│    │  # product    │      ┌──────────────────────────┐    │                  │
│    │ DIRECT        │      │ 🎙  📷  🖥  😊  🎧  ⏏    │    │                  │
│    │  ● Lena       │      └──────────────────────────┘    │                  │
└────┴───────────────┴──────────────────────────────────────┴──────────────────┘
 rail   sidebar                stage (world or list mode)       context panel
```

- **Rail:** Office (world), Channels, Direct, Calendar (later), Admin.
- **Sidebar:** rooms with occupancy, channels, DMs, all keyboard-navigable. This is also the list mode foundation.
- **Stage:** the world, or **list mode** (rooms as cards with occupants). Switch with one key (proposal: `L`).
- **Media dock:** mic, camera, screen, emote, focus, leave conversation. It floats at the bottom centre.
- **Context panel:** shows what you are "in" (the room wall of the current room, the conversation, a thread). Collapsible.
- **Toasts:** knock requests, incoming calls with *Admit / Decline*.

## 3. Core components (MVP, proposal)

| Category | Components |
|----------|------------|
| Primitives | Button (primary, secondary, ghost, danger), IconButton, Input, Textarea, Select, Checkbox, Switch, Tooltip, Popover, Dialog, Menu, Tabs, Toast, Badge, Avatar (2D) |
| Presence | StatusDot (colour + shape), PresencePill, PersonChip, RoomOccupancy |
| Messaging | MessageList (virtualised), MessageItem, Composer (mentions, emoji, files), ThreadPanel, ReactionBar, ChannelHeader |
| Meetings | MediaDock, VideoTile, ScreenShareTile, KnockToast, IncomingCallDialog, ConversationCard |
| Navigation | CommandPalette, Rail, Sidebar sections, FloorSwitcher, Minimap |
| Admin | RoleEditor (permission matrix), RoomPolicyForm, AuditLogTable, SetupWizard steps |
| Editor | ToolPalette, CatalogueGrid, PropertiesPanel, PublishBar |

## 4. Shape & spacing

- Radius: `6` (inputs), `10` (cards and buttons), `16` (panels, dock), `full` (pills, avatars).
  Soft, never sharp, echoing the low-poly world's bevelled edges.
- Spacing: 4 px base scale (`4, 8, 12, 16, 24, 32, 48`).
- Elevation: warm, low shadows tinted with espresso (`0 1px 2px rgb(43 31 26 / .08), 0 8px 24px rgb(43 31 26 / .08)`).

## 5. Accessibility baseline

- WCAG 2.2 AA for all UI (contrast, focus visible, target size ≥ 24 px).
- Focus ring: 2 px `terracotta-700` + 2 px cream offset.
- Every world interaction has a sidebar, list mode or command palette equivalent.
- `prefers-reduced-motion` and a performance mode in settings.
