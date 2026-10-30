import { useQuery } from '@tanstack/react-query';
import { FloorListResponse, FloorPlan, HealthResponse, MeResponse, MeetingLogListResponse } from '@teamtown/contracts';
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
