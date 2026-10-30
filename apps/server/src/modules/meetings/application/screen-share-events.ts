import type { ScreenShareChange } from '../domain/screen-shares.ts';
import type { CallMembership } from './call-membership.ts';
import type { MeetingsEvent } from './meetings-event-stream.ts';

/** A change goes to everyone in the call, and to the previous sharer so their app stops sharing. */
export function screenShareEvent(change: ScreenShareChange, membership: CallMembership): MeetingsEvent {
  const recipients = new Set(membership.participantsOf(change.callKey));
  if (change.previous) recipients.add(change.previous);
  return { type: 'ScreenShareChanged', sharer: change.sharer, recipients: [...recipients] };
}
