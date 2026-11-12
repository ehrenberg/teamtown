import type { BrowseChannelsResponse, FloorPlan, FloorSummary, Place } from '@teamtown/contracts';
import type { TFunction } from 'i18next';

export interface ScopeOption {
  readonly scope: string;
  readonly label: string;
}

export interface Places {
  readonly floors: readonly FloorSummary[];
  /** Plans of the floors, for their rooms; a plan may still be loading. */
  readonly plans: readonly FloorPlan[];
  readonly channels: BrowseChannelsResponse['channels'];
}

/** The scopes a role can be given at, from the places the server says it applies to (P-37). */
export function scopesFor(places: readonly Place[], { floors, plans, channels }: Places, t: TFunction): ScopeOption[] {
  return [
    ...(places.includes('town') ? [{ scope: 'town', label: t('admin.scopeTown') }] : []),
    ...(places.includes('floor')
      ? floors.map((floor) => ({ scope: `floor:${floor.floorId}`, label: floor.name }))
      : []),
    ...(places.includes('room')
      ? plans.flatMap((plan) =>
          plan.rooms.map((room) => ({
            scope: `room:${plan.floorId}/${room.id}`,
            label: `${plan.name} · ${room.name}`,
          })),
        )
      : []),
    ...(places.includes('channel')
      ? channels.map((channel) => ({ scope: `channel:${channel.channelId}`, label: `#${channel.name}` }))
      : []),
  ];
}

/**
 * Names a scope. A channel not among the public ones is private, and shows no name: admins don't read private content
 * (ADR-0026). A room or floor that no longer exists says so.
 */
export function scopeLabel(scope: string, { floors, plans, channels }: Places, t: TFunction): string {
  if (scope === 'town') return t('admin.scopeTown');
  const [kind, id = ''] = scope.split(/:(.*)/s);
  if (kind === 'channel') {
    const channel = channels.find((candidate) => candidate.channelId === id);
    return channel ? `#${channel.name}` : t('admin.privateChannel');
  }
  if (kind === 'floor') return floors.find((floor) => floor.floorId === id)?.name ?? t('admin.unknownPlace');
  const [floorId, roomId] = id.split('/');
  const plan = plans.find((candidate) => candidate.floorId === floorId);
  const room = plan?.rooms.find((candidate) => candidate.id === roomId);
  return plan && room ? `${plan.name} · ${room.name}` : t('admin.unknownPlace');
}
