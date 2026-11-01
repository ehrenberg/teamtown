// The only entry point other modules may import from the Messaging context.
export { MessagingEventStream, type MessagingEventListener } from './application/messaging-event-stream.ts';
export type { MessageSnapshot, MessagingEvent } from './domain/events.ts';
export { MessagingModule } from './messaging.module.ts';
