import { err, type Result } from '@teamtown/kernel';
import type { LockError } from '../domain/floor-conversations.ts';
import type { ConversationRegistry } from './conversation-registry.ts';
import type { MeetingsEventStream } from './meetings-event-stream.ts';

/** Any participant may lock or unlock; roles only arrive with M4 (ADR-0031). */
export class SetConversationLock {
  constructor(
    private readonly registry: ConversationRegistry,
    private readonly events: MeetingsEventStream,
  ) {}

  execute(input: { personId: string; conversationId: string; locked: boolean }): Result<void, LockError> {
    const found = this.registry.find(input.conversationId);
    if (!found) return err('conversation-not-found');
    const { conversations } = found.floor;
    const result = input.locked
      ? conversations.lock(input.conversationId, input.personId)
      : conversations.unlock(input.conversationId, input.personId);
    this.events.publish(conversations.pullEvents());
    return result;
  }
}
