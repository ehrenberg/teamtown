import type { MeetingLog } from '../domain/meeting-log.ts';
import type { MeetingsEvent } from './meetings-event-stream.ts';

/** What the people in a logged meeting see of it. */
export const meetingLogDetails = (log: MeetingLog) => ({
  meetingId: log.props.meetingId,
  title: log.props.title,
  hostId: log.props.hostId,
});

export const meetingLogEndedEvents = (
  floorId: string,
  roomId: string,
  occupants: readonly string[],
): MeetingsEvent[] => [
  { type: 'MeetingLogChanged', floorId, roomId, active: false },
  { type: 'MeetingLogDetails', roomId, details: null, recipients: occupants },
];
