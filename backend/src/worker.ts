// =====================================================
// Standalone Worker Entry Point
// =====================================================
// Runs as a separate process for background tasks.
// Usage: node dist/worker.js
// =====================================================

import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { QueueScheduler } from './queue/queue.scheduler';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Worker');
  const app = await NestFactory.createApplicationContext(AppModule);

  logger.log('Worker process started');
  logger.log('Background tasks will run on schedule');

  // The @Cron decorators in QueueScheduler handle scheduling automatically
  // This process just needs to stay alive

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    logger.log('Worker shutting down...');
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    logger.log('Worker shutting down...');
    await app.close();
    process.exit(0);
  });
}

bootstrap();
