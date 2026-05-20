// =====================================================
// BullMQ Queue Module - Background job definitions
// =====================================================

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { QueueScheduler } from './queue.scheduler';
import { PlaylistModule } from '../playlist/playlist.module';
import { HealthCheckModule } from '../health-check/health-check.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [PlaylistModule, HealthCheckModule, CommonModule],
  providers: [QueueScheduler],
  exports: [QueueScheduler],
})
export class QueueModule {}
