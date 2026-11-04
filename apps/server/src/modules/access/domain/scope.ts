/** Where something applies (ADR-0011): town ▸ floor ▸ room, and town ▸ channel. */
export type ScopeRef =
  | { readonly kind: 'town' }
  | { readonly kind: 'floor'; readonly floorId: string }
  | { readonly kind: 'room'; readonly floorId: string; readonly roomId: string; readonly private?: boolean }
  | { readonly kind: 'channel'; readonly channelId: string; readonly private?: boolean };

export const TOWN: ScopeRef = { kind: 'town' };

/** Stable text form, for storing and comparing scopes. */
export function scopeKey(scope: ScopeRef): string {
  switch (scope.kind) {
    case 'town':
      return 'town';
    case 'floor':
      return `floor:${scope.floorId}`;
    case 'room':
      return `room:${scope.floorId}/${scope.roomId}`;
    case 'channel':
      return `channel:${scope.channelId}`;
  }
}

/** The scope itself and everything above it, nearest first. */
export function withParents(scope: ScopeRef): readonly ScopeRef[] {
  switch (scope.kind) {
    case 'town':
      return [scope];
    case 'floor':
      return [scope, TOWN];
    case 'room':
      return [scope, { kind: 'floor', floorId: scope.floorId }, TOWN];
    case 'channel':
      return [scope, TOWN];
  }
}
