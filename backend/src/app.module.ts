// =====================================================
// IPTV Manager - Root Application Module
// =====================================================

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { PlaylistModule } from './playlist/playlist.module';
import { ChannelModule } from './channel/channel.module';
import { OutputModule } from './output/output.module';
import { HealthCheckModule } from './health-check/health-check.module';
import { AdminModule } from './admin/admin.module';
import { AuditModule } from './audit/audit.module';
import { QueueModule } from './queue/queue.module';
import { AppController } from './app.controller';
import { appConfig } from './config/app.config';

@Module({
  imports: [
    // ---- Config ----
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig],
      cache: true,
    }),

    // ---- Rate Limiting ----
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'long',
        ttl: 3600000,
        limit: 1000,
      },
    ]),

    // ---- Scheduler ----
    ScheduleModule.forRoot(),

    // ---- Core ----
    PrismaModule,
    RedisModule,
    AuditModule,

    // ---- Features ----
    AuthModule,
    PlaylistModule,
    ChannelModule,
    OutputModule,
    HealthCheckModule,
    AdminModule,
    QueueModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
