# World Art Direction

Decided: **soft low-poly** world style, **stylised low-poly avatars**, Three.js rendering, tile-grid
office. Concrete values below are a **proposal** for the art pipeline.

## 1. Look in one sentence

_An architect's model of your office on a sunny afternoon:_ clean low-poly shapes, soft bevels,
warm materials, gentle daylight from the top left, terracotta and sage accents on cream.

Reference moods: architectural models, Monument Valley (calmness, colour), Mini Motorways (clarity), and
Scandinavian office interiors.

## 2. Light & shading

- Key light from the **top left** (same as the logo), warm white (`#FFF4E6`). Soft ambient fill (sky colour, cream).
- Faces read in **three tones**: top lightest, left lit, right in shade, like the logo.
- Soft, blurred shadows (baked for static geometry, simple blob shadows for avatars).
- Optional time-of-day tint (later, brainstorming S8).

## 3. Material palette (proposal)

| Element                | Colour                               | Notes                                      |
| ---------------------- | ------------------------------------ | ------------------------------------------ |
| Wooden floor           | `#E9D3B4`                            | Default office floor                       |
| Carpet (meeting rooms) | `#B9CDB9` (sage tint)                | Signals "quiet room"                       |
| Kitchen tiles          | `#F3ECE1` + terracotta grout accents | Social space                               |
| Walls                  | `#F3ECE1`, top edge `#FBF6EE`        | Cut-away walls show a darker cap `#CFC2B0` |
| Accent walls           | `#D9653B`                            | Max. one per room                          |
| Glass walls            | ocean `#2F6F8F` at 25 % opacity      | Meeting rooms; frosted when locked         |
| Plants                 | `#8FB59A` / `#6E9A7A`                | Everywhere! Plants make it human           |
| Furniture wood         | `#C69C72`                            | Desks, tables                              |
| Furniture fabric       | ocean, sage, ochre, terracotta       | Chairs, sofas                              |
| Lit objects            | ochre `#E8B04A`                      | Lamps, screens on, windows                 |

All world colours live in one **palette texture** (a 16×16 swatch atlas), so every model shares one material.

## 4. Avatars

- **Proportions:** stylised but adult, about 1 : 4.5 head-to-body. Friendly, not chibi, not realistic.
- Rounded, faceted forms. Simple face (two dots for eyes, optional smile line), with no detailed mouth animation.
- **Customisation (MVP proposal):** skin tone (at least 8 tones), hair style (10) and colour, top (8) and
  colour, bottom (4), accessory (glasses, headscarf, cap, beard, earrings…). Inclusive by default.
- **Animations:** idle (breathing), walk, sit, wave, raise hand, typing (seated). Max. 8 bones per limb chain.
- **Indicators** (HTML overlay, not 3D): name plate with status shape, speaking ring (sage glow while
  speaking), muted icon.
- **Status body language:** headphones (focus), coffee cup (break), laptop closed and chair pushed back (away).

## 5. Technical budgets & conventions

| Item           | Budget                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------- |
| Avatar         | ≤ 1,500 triangles, 1 material (palette texture)                                                             |
| Furniture item | ≤ 600 triangles (plants ≤ 400)                                                                              |
| Tile footprint | 0.5 m; furniture snaps to tiles; pivot at the footprint's bottom-left corner                                |
| Format         | glTF binary (`.glb`), Y-up, metres, Draco or meshopt compression                                            |
| Naming         | `furn_desk_straight_160.glb`, `furn_chair_office_ocean.glb`, `avtr_hair_bun.glb`, `deco_plant_monstera.glb` |
| Source files   | `.blend` in this repository via **Git LFS** _(decided)_; exported `.glb` in `apps/web/public/assets`        |

## 6. MVP furniture catalogue (proposal, ~30 items)

Desks (straight, L-shape, standing), office chair (4 colours), meeting tables (4 / 8 seats), sofa,
armchair, coffee table, kitchen counter, coffee machine, fridge, bar table + stools, bookshelf, sideboard,
TV/screen wall (for screen share), whiteboard, plants (3), floor lamp, desk lamp, rug (2), phone booth,
printer, coat rack, reception desk, stage riser (later), doors (single, double, glass), windows.
