/**
 * World material colours (docs/design/world-art-direction.md §3).
 * Will move to a shared palette texture once real glTF furniture exists.
 */
export const WORLD_PALETTE = {
  floor: {
    wood: '#E9D3B4',
    carpet: '#BFD0BD',
    tiles: '#F1E9DC',
    concrete: '#D8D2C8',
    terrace: '#CDB79A',
  },
  wall: { solid: '#F3ECE1', accent: '#D9653B', glass: '#9CC3D3' },
  wallCap: '#CFC2B0',
  slab: '#D9C3A5',
  wood: '#C69C72',
  woodDark: '#8F6A48',
  cream: '#FBF6EE',
  espresso: '#2B1F1A',
  terracotta: '#D9653B',
  terracottaLight: '#F0CDBA',
  sage: '#8FB59A',
  sageDark: '#6E9A7A',
  ocean: '#2F6F8F',
  ochre: '#E8B04A',
  screen: '#22546C',
  white: '#FFFFFF',
  hover: '#8FB59A',
  keyLight: '#FFF4E6',
} as const;
