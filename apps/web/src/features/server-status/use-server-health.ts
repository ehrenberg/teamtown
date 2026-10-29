import { useQuery } from '@tanstack/react-query';
import { HealthResponse } from '@teamtown/contracts';

const HEALTH_POLL_INTERVAL_MS = 15_000;

/** Fetches and validates `GET /api/health` against the shared contract. */
export async function fetchServerHealth(fetchImpl: typeof fetch = fetch): Promise<HealthResponse> {
  const response = await fetchImpl('/api/health');
  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}`);
  }
  return HealthResponse.parse(await response.json());
}

export const useServerHealth = () =>
  useQuery({
    queryKey: ['server-health'],
    queryFn: () => fetchServerHealth(),
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    retry: false,
  });
