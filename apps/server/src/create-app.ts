import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { Logger } from 'nestjs-pino';
import { AppModule, type AppOverrides } from './app.module.ts';
import type { AppConfig } from './platform/config/app-config.ts';
import { nameHttpSpansByRoute } from './platform/telemetry/http-span-naming.ts';

export const API_PREFIX = 'api';

/** Builds the application without listening, so tests and main.ts share the same setup. */
export async function createApp(config: AppConfig, overrides: AppOverrides = {}): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule.forRoot(config, overrides),
    new FastifyAdapter(),
    // Startup logs are buffered until the JSON logger (pino) is ready.
    { bufferLogs: true },
  );
  app.useLogger(app.get(Logger));
  nameHttpSpansByRoute(app.getHttpAdapter().getInstance());
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  return app;
}
