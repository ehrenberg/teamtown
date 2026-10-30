import { err, ok, type Result } from '@teamtown/kernel';
import type { ConversationMedia } from './conversation-media.ts';
import type { ConversationRegistry } from './conversation-registry.ts';

export type ConversationTokenError = 'conversation-not-found' | 'not-in-conversation' | 'media-unavailable';

export class RequestConversationToken {
  constructor(
    private readonly registry: ConversationRegistry,
    private readonly media: ConversationMedia,
  ) {}

  async execute(input: {
    personId: string;
    conversationId: string;
  }): Promise<Result<{ url: string; token: string }, ConversationTokenError>> {
    const found = this.registry.find(input.conversationId);
    if (!found) return err('conversation-not-found');
    if (!found.conversation.participants.includes(input.personId)) return err('not-in-conversation');
    const access = await this.media.tokenFor(input.conversationId, input.personId);
    return access ? ok(access) : err('media-unavailable');
  }
}
