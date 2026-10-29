import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { HealthResponse } from '@teamtown/contracts';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../../create-app.ts';

describe('GET /api/health', () => {
  let app: NestFastifyApplication;

  beforeAll(async () => {
    app = await createApp({ NODE_ENV: 'test', HOST: '127.0.0.1', PORT: 0 });
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('answers with a response that matches the shared contract', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/health' });

    expect(response.statusCode).toBe(200);
    expect(HealthResponse.safeParse(response.json()).success).toBe(true);
  });
});
