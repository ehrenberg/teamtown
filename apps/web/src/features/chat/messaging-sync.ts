import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { MessageContract } from '@teamtown/contracts';
import { messagesKey, repliesKey } from '../../api/queries.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { withDeleted, withPosted, withReaction, withReplaced, withReply, type MessagePages } from './message-cache.ts';

/** A message goes to the channel; a reply to its thread, onto its root's count, and to the channel if also sent there. */
function onPosted(queryClient: QueryClient, message: MessageContract): void {
  if (message.threadRootId) {
    queryClient.setQueryData<MessagePages>(repliesKey(message.threadRootId), (data) => withPosted(data, message));
    queryClient.setQueryData<MessagePages>(messagesKey(message.channelId), (data) => withReply(data, message));
  }
  if (!message.threadRootId || message.alsoInChannel) {
    queryClient.setQueryData<MessagePages>(messagesKey(message.channelId), (data) => withPosted(data, message));
  }
}

/**
 * Keeps the messaging server state fresh: pushes update loaded histories and threads and reload the channel list
 * (unread and mention counts) and the threads view; a reconnect reloads all of them, since pushes may have been
 * missed meanwhile.
 */
export function MessagingSync(): null {
  const realtime = useRealtime();
  const queryClient = useQueryClient();
  const connection = usePresenceStore((state) => state.connection);

  useEffect(
    () =>
      realtime.onMessagingEvent((event) => {
        const refreshChannels = () => void queryClient.invalidateQueries({ queryKey: ['channels'] });
        /** Applies a change to the channel history and to every loaded thread (the message may be in either). */
        const update = (channelId: string, change: (data: MessagePages | undefined) => MessagePages | undefined) => {
          queryClient.setQueryData<MessagePages>(messagesKey(channelId), change);
          queryClient.setQueriesData<MessagePages>({ queryKey: ['replies'] }, change);
        };
        switch (event.t) {
          case 'MessagePosted':
            onPosted(queryClient, event.p.message);
            refreshChannels();
            return;
          case 'MessageEdited':
            update(event.p.message.channelId, (data) => withReplaced(data, event.p.message));
            return;
          case 'MessageDeleted':
            update(event.p.channelId, (data) => withDeleted(data, event.p.messageId));
            refreshChannels();
            return;
          case 'ReactionChanged':
            update(event.p.channelId, (data) => withReaction(data, event.p));
            return;
          case 'ThreadActivity':
            void queryClient.invalidateQueries({ queryKey: ['threads'] });
            return;
          case 'ChannelLeft':
            if (useChatStore.getState().openChannelId === event.p.channelId) useChatStore.getState().close();
            queryClient.removeQueries({ queryKey: messagesKey(event.p.channelId) });
            refreshChannels();
            void queryClient.invalidateQueries({ queryKey: ['channels-browse'] });
            return;
          case 'ChannelChanged':
            refreshChannels();
            void queryClient.invalidateQueries({ queryKey: ['channels-browse'] });
            return;
          case 'ReadMarkerMoved':
            refreshChannels();
        }
      }),
    [realtime, queryClient],
  );

  useEffect(() => {
    if (connection !== 'online') return;
    for (const queryKey of [['channels'], ['messages'], ['replies'], ['threads']]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [connection, queryClient]);

  return null;
}
