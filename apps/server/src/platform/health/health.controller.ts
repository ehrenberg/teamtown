import { Controller, Get, Inject } from '@nestjs/common';
import type { HealthResponse } from '@teamtown/contracts';
import type { Clock } from '@teamtown/kernel';
import packageJson from '../../../package.json' with { type: 'json' };
import { CLOCK } from '../config/config.module.ts';

@Controller('health')
export class HealthController {
  readonly #startedAt: Date;

  constructor(@Inject(CLOCK) private readonly clock: Clock) {
    this.#startedAt = clock.now();
  }

  @Get()
  check(): HealthResponse {
    const uptimeMs = this.clock.now().getTime() - this.#startedAt.getTime();
    return {
      status: 'ok',
      version: packageJson.version,
      uptimeSeconds: Math.floor(uptimeMs / 1000),
    };
  }
}
