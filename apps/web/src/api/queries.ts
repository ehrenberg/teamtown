import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  AccessOverviewResponse,
  BrowseChannelsResponse,
  ChannelListResponse,
  ChannelSummarySchema,
  FloorListResponse,
  FloorPlan,
  HealthResponse,
  MeResponse,
  MeetingLogListResponse,
  MessagePageResponse,
  MyAccessResponse,
  PeopleListResponse,
  PinnedMessagesResponse,
  ThreadListResponse,
} from '@teamtown/contracts';
import { apiGet } from './api-client.ts';

const HEALTH_POLL_INTERVAL_MS = 15_000;

export const useServerHealth = () =>
  useQuery({
    queryKey: ['health'],
    queryFn: () => apiGet('/health', HealthResponse),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    retry: false,
  });

export const useMe = () => useQuery({ queryKey: ['me'], queryFn: () => apiGet('/me', MeResponse) });

/** What the person may administer (ADR-0038). */
export const useMyAccess = () =>
  useQuery({ queryKey: ['access', 'me'], queryFn: () => apiGet('/access/me', MyAccessResponse) });

export const useAccessOverview = (enabled: boolean) =>
  useQuery({
    queryKey: ['access', 'overview'],
    queryFn: () => apiGet('/access/overview', AccessOverviewResponse),
    enabled,
  });

export const useFloors = () => useQuery({ queryKey: ['floors'], queryFn: () => apiGet('/floors', FloorListResponse) });

/** Published floor plans are immutable per version, so they never need refetching while the app runs. */
export const useFloorPlan = (floorId: string | null) =>
  useQuery({
    queryKey: ['floor-plan', floorId],
    queryFn: () => apiGet(`/floors/${encodeURIComponent(floorId ?? '')}/plan`, FloorPlan),
    enabled: floorId !== null,
    staleTime: Number.POSITIVE_INFINITY,
  });

/** Logged meetings one took part in (ADR-0026/0027); fetched when the dialog opens. */
export const useMyMeetingLogs = (enabled: boolean) =>
  useQuery({
    queryKey: ['meeting-logs'],
    queryFn: () => apiGet('/meeting-logs', MeetingLogListResponse),
    enabled,
  });

/** My channels and DMs with unread counts; kept fresh by realtime pushes (features/chat/messaging-sync.ts). */
export const useChannels = () =>
  useQuery({ queryKey: ['channels'], queryFn: () => apiGet('/channels', ChannelListResponse) });

/** One channel, for one the person can read but isn't in, such as a public channel found by search. */
export const useChannel = (channelId: string | null, enabled: boolean) =>
  useQuery({
    queryKey: ['channel', channelId],
    queryFn: () => apiGet(`/channels/${encodeURIComponent(channelId ?? '')}`, ChannelSummarySchema),
    enabled: enabled && channelId !== null,
  });

export const useBrowseChannels = (enabled: boolean) =>
  useQuery({
    queryKey: ['channels-browse'],
    queryFn: () => apiGet('/channels/browse', BrowseChannelsResponse),
    enabled,
  });

/** Everyone in the town, for picking people for a DM. */
export const usePeople = (enabled = true) =>
  useQuery({ queryKey: ['people'], queryFn: () => apiGet('/people', PeopleListResponse), enabled });

export const messagesKey = (channelId: string) => ['messages', channelId] as const;

/** A channel's history: page 0 holds the newest messages, later pages older ones (each oldest first). */
export const useMessages = (channelId: string | null) =>
  useInfiniteQuery({
    queryKey: messagesKey(channelId ?? ''),
    queryFn: ({ pageParam }) =>
      apiGet(
        `/channels/${encodeURIComponent(channelId ?? '')}/messages${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`,
        MessagePageResponse,
      ),
    initialPageParam: '',
    getNextPageParam: (page) => (page.hasMore ? page.messages[0]?.messageId : undefined),
    enabled: channelId !== null,
  });

export const pinnedKey = (channelId: string) => ['pinned', channelId] as const;

/** A conversation's pinned messages, newest first (P-24); kept fresh by realtime pushes. */
export const usePinned = (channelId: string) =>
  useQuery({
    queryKey: pinnedKey(channelId),
    queryFn: () => apiGet(`/channels/${encodeURIComponent(channelId)}/pinned-messages`, PinnedMessagesResponse),
  });

export const repliesKey = (rootMessageId: string) => ['replies', rootMessageId] as const;

/** A thread's replies, paged like a channel's history (ADR-0034); loaded when the thread is expanded. */
export const useReplies = (channelId: string, rootMessageId: string, enabled: boolean) =>
  useInfiniteQuery({
    queryKey: repliesKey(rootMessageId),
    queryFn: ({ pageParam }) =>
      apiGet(
        `/channels/${encodeURIComponent(channelId)}/messages/${encodeURIComponent(rootMessageId)}/replies${pageParam ? `?before=${encodeURIComponent(pageParam)}` : ''}`,
        MessagePageResponse,
      ),
    initialPageParam: '',
    getNextPageParam: (page) => (page.hasMore ? page.messages[0]?.messageId : undefined),
    enabled,
  });

/** The threads I follow with unread replies; kept fresh by `ThreadActivity` pushes. */
export const useThreads = () =>
  useQuery({ queryKey: ['threads'], queryFn: () => apiGet('/threads', ThreadListResponse) });
