// The only entry point other modules may import from the Access context.
export { AccessModule } from './access.module.ts';
export { ACCESS_POLICY, type AccessPolicy } from './application/access-policy.ts';
export { AssignChannelModerator } from './application/assign-channel-moderator.ts';
export { ClaimFirstOwner } from './application/claim-first-owner.ts';
export type { Permission } from './domain/permissions.ts';
export type { ScopeRef } from './domain/scope.ts';
