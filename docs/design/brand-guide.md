# TeamTown Brand Guide (Corporate Identity)

**Decided (2026-10-29):** Terracotta colour family, logo idea "isometric house with an open door",
typography Outfit + Inter + JetBrains Mono, Lucide icons, tone "warm & clear, lightly playful",
claim "Where teams live.", German UI uses "du".
Items marked **(proposal)** or **(open)** still need a decision.

---

## 1. Brand essence

|                     |                                                                                                         |
| ------------------- | ------------------------------------------------------------------------------------------------------- |
| **Idea**            | The office you can walk into from anywhere                                                              |
| **Promise**         | Closeness without surveillance: you see who's around, nobody tracks you                                 |
| **Personality**     | Warm · clear · reliable · lightly playful · grounded (like a well-designed office building, not a game) |
| **Visual metaphor** | Architecture: terracotta roofs, warm materials, soft daylight, isometric architectural models           |

### Claim (decided)

| EN                    | DE                         |
| --------------------- | -------------------------- |
| **Where teams live.** | **Wo Teams zuhause sind.** |

## 2. Name

- Always **TeamTown**: one word, two capitals. Never "Team Town", "Teamtown" or "TEAMTOWN" in running text.
- Plural or possessive in running text: "TeamTown's editor". In code: `teamtown` (package names) or `TeamTown`.

## 3. Logo

**Concept:** An isometric building block with a **terracotta roof**, an **open door** spilling warm
ochre light, lit windows, and a sage **presence dot** floating above it: _"Someone's here. Come in."_

| File                                                                                   | Use                                             |
| -------------------------------------------------------------------------------------- | ----------------------------------------------- |
| [`design/brand/logo-mark.svg`](../../design/brand/logo-mark.svg)                       | Symbol only (favicons, avatars, small sizes)    |
| [`design/brand/logo-horizontal.svg`](../../design/brand/logo-horizontal.svg)           | Primary logo on light backgrounds               |
| [`design/brand/logo-horizontal-dark.svg`](../../design/brand/logo-horizontal-dark.svg) | Primary logo on dark backgrounds                |
| [`design/brand/app-icon.svg`](../../design/brand/app-icon.svg)                         | App icon (Electron, PWA, store), rounded square |

**Construction:** The mark is built on a true isometric grid (30° axes). Faces follow the brand light:
**light comes from the top left**. The roof is terracotta, the left wall is lit and the right wall is in shade.
On light backgrounds the walls are warm espresso tones; on dark backgrounds they are cream and sand.
The world art follows the same light rule.

**Clear space:** at least the height of the presence dot on all sides.
**Minimum size:** mark 16 px (favicon variant without windows, proposal), horizontal logo 96 px wide.

**Don'ts:** don't rotate, stretch, recolour outside the palette, add shadows or outlines, place the
light logo on busy photos, or separate the presence dot from the house except in loading animations.

> Note: the wordmark in the SVG files uses live text in _Outfit_. Before production use, convert the text to
> outlines (open task).

## 4. Colour

### Core palette (decided)

| Token        | Hex       | Role                                                                |
| ------------ | --------- | ------------------------------------------------------------------- |
| `espresso`   | `#2B1F1A` | Primary text, dark surfaces                                         |
| `terracotta` | `#D9653B` | **Brand primary**: roofs, highlights, illustrations, large surfaces |
| `sage`       | `#8FB59A` | Freshness, _available_, nature and plants                           |
| `ocean`      | `#2F6F8F` | Secondary: links, information, focus state, glass                   |
| `ochre`      | `#E8B04A` | Highlights: lit windows, warm light, badges                         |
| `cream`      | `#FBF6EE` | Main background                                                     |

### Accessible variants (derived, proposal)

Terracotta and sage are too light for small text on cream. For text and interactive elements use:

| Token            | Hex       | Contrast on cream | Use                                                       |
| ---------------- | --------- | ----------------- | --------------------------------------------------------- |
| `terracotta-700` | `#B54D2A` | ≈ 4.7 : 1 ✔ AA    | Primary buttons (white text), links on cream, focus rings |
| `sage-700`       | `#4F7A5C` | ≈ 4.6 : 1 ✔ AA    | "Available" text labels                                   |
| `ocean`          | `#2F6F8F` | ≈ 5.2 : 1 ✔ AA    | Links, info text                                          |
| `espresso`       | `#2B1F1A` | ≈ 16 : 1 ✔ AAA    | Body text                                                 |

The full scales (50–900) are in [`design/tokens/tokens.json`](../../design/tokens/tokens.json).

### Status colours (proposal)

Status is **always colour + shape** (colour-blind safe):

| Status              | Colour               | Shape / icon             |
| ------------------- | -------------------- | ------------------------ |
| Available           | sage `#5F9470`       | filled circle ●          |
| In a meeting / busy | terracotta `#D9653B` | circle with a bar ⊖      |
| Focus               | ocean `#2F6F8F`      | headphones 🎧 / crescent |
| Away                | ochre `#E8B04A`      | clock ◔                  |
| Offline             | warm grey `#A89A88`  | ring ○                   |

## 5. Typography (decided)

| Use                                             | Font               | Weights       | Licence |
| ----------------------------------------------- | ------------------ | ------------- | ------- |
| Logo wordmark, headlines, display, world labels | **Outfit**         | 500, 600, 700 | SIL OFL |
| UI and body text                                | **Inter**          | 400, 500, 600 | SIL OFL |
| Code, IDs, technical values                     | **JetBrains Mono** | 400           | SIL OFL |

Type scale (proposal, rem at 16 px base): `12 · 14 · 16 · 18 · 22 · 28 · 36 · 48`.
Headlines in Outfit 600 with tight letter spacing (−0.01 em). Body in Inter 400/1.5.

## 6. Voice & tone (decided: warm & clear, lightly playful)

Roughly **80 % clear and factual, 20 % wink**. Office and town metaphors are used where they help
understanding ("knock", "door closed"), never as forced puns. **Errors and security messages are
always plain and helpful, never jokey.**

| Situation       | ✔ Do                                                                                                              | ✘ Don't                                              |
| --------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Room locked     | EN "This room is locked. Knock to ask for entry." · DE "Dieser Raum ist verschlossen. Klopf an, um reinzukommen." | "Access denied (403)" · "Nope, no entry for you! 🙅" |
| Empty channel   | EN "It's quiet here. Start the conversation." · DE "Noch ganz ruhig hier. Fang einfach an."                       | "No data available."                                 |
| Connection lost | EN "Connection lost. Reconnecting…" · DE "Verbindung unterbrochen. Wir verbinden dich neu…"                       | "Oops, the town fell asleep 😴"                      |
| Focus mode on   | EN "Focus mode: only urgent knocks get through." · DE "Fokus-Modus: Nur dringendes Anklopfen kommt durch."        |                                                      |

German UI uses the informal **"du"** _(decided)_.

## 7. Iconography & illustration

- UI icons: **Lucide** (ISC licence), 1.5 px stroke, rounded joins _(decided)_.
- Illustrations and marketing visuals are **isometric scenes in the world style** (see
  [world-art-direction.md](world-art-direction.md)), with the same light direction and palette.

## 8. Motion (proposal)

- Calm and physical: ease-out 150–250 ms for UI, no bouncy overshoot except for small delight moments
  (emotes, presence dot pulse).
- Signature motion: the **presence dot** gently pulses when someone is nearby or knocking.
- All motion respects `prefers-reduced-motion`.
