import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module.ts';
import type { AppConfig } from './platform/config/app-config.ts';

export const API_PREFIX = 'api';

/** Builds the application without listening, so tests and main.ts share the same setup. */
export async function createApp(config: AppConfig): Promise<NestFastifyApplication> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule.forRoot(config), new FastifyAdapter(), {
    logger: config.NODE_ENV === 'test' ? false : ['log', 'warn', 'error'],
  });
  app.setGlobalPrefix(API_PREFIX);
  app.enableShutdownHooks();
  return app;
}
