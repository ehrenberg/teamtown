import { beforeEach, describe, expect, it } from 'vitest';
import { useChatStore } from './chat-store.ts';

const store = () => useChatStore.getState();

describe('chat store', () => {
  beforeEach(() => {
    store().close();
  });

  it('shows a reply through its opened thread, leaving the pinned view', () => {
    store().open('c1');
    store().togglePinned();

    store().show({ channelId: 'c1', messageId: 'reply', threadRootId: 'root' });

    expect(store()).toMatchObject({ openChannelId: 'c1', pinnedOpen: false });
    expect(store().expandedThreads.has('root')).toBe(true);
  });

  it('leaves the threads view for a message in another channel, forgetting the old threads', () => {
    store().open('c1');
    store().toggleThread('old-root');
    store().openThreads();

    store().show({ channelId: 'c2', messageId: 'm', threadRootId: null });

    expect(store()).toMatchObject({ openChannelId: 'c2', threadsOpen: false });
    expect(store().expandedThreads.size).toBe(0);
  });

  it('keeps open threads when the same channel is opened again, and in the same channel when showing', () => {
    store().open('c1');
    store().toggleThread('root');

    store().open('c1');
    store().show({ channelId: 'c1', messageId: 'm', threadRootId: null });

    expect(store().expandedThreads.has('root')).toBe(true);
  });
});
