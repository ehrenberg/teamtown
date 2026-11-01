import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import {
  BrowseChannelsResponse,
  ChannelListResponse,
  FloorListResponse,
  FloorPlan,
  HealthResponse,
  MeResponse,
  MeetingLogListResponse,
  MessagePageResponse,
  PeopleListResponse,
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
