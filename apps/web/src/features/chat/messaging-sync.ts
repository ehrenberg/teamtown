import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { messagesKey } from '../../api/queries.ts';
import { useRealtime } from '../../realtime/realtime-context.tsx';
import { useChatStore } from '../../stores/chat-store.ts';
import { usePresenceStore } from '../../stores/presence-store.ts';
import { withDeleted, withPosted, withReplaced, type MessagePages } from './message-cache.ts';

/**
 * Keeps the messaging server state fresh: pushes update loaded histories and reload the channel list (unread
 * counts); a reconnect reloads both, since pushes may have been missed meanwhile.
 */
export function MessagingSync(): null {
  const realtime = useRealtime();
  const queryClient = useQueryClient();
  const connection = usePresenceStore((state) => state.connection);

  useEffect(
    () =>
      realtime.onMessagingEvent((event) => {
        const refreshChannels = () => void queryClient.invalidateQueries({ queryKey: ['channels'] });
        switch (event.t) {
          case 'MessagePosted':
            queryClient.setQueryData<MessagePages>(messagesKey(event.p.message.channelId), (data) =>
              withPosted(data, event.p.message),
            );
            refreshChannels();
            return;
          case 'MessageEdited':
            queryClient.setQueryData<MessagePages>(messagesKey(event.p.message.channelId), (data) =>
              withReplaced(data, event.p.message),
            );
            return;
          case 'MessageDeleted':
            queryClient.setQueryData<MessagePages>(messagesKey(event.p.channelId), (data) =>
              withDeleted(data, event.p.messageId),
            );
            refreshChannels();
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
    void queryClient.invalidateQueries({ queryKey: ['channels'] });
    void queryClient.invalidateQueries({ queryKey: ['messages'] });
  }, [connection, queryClient]);

  return null;
}
