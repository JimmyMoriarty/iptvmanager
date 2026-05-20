// =====================================================
// Stream Health Checker Service
// =====================================================
// Uses lightweight HEAD/partial-GET requests only.
// NEVER proxies or forwards video traffic.
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SafeFetcherService } from '../common/safe-fetcher.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthCheckService {
  private readonly logger = new Logger(HealthCheckService.name);
  private readonly concurrency: number;
  private readonly autoDisableAfter: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: SafeFetcherService,
    private readonly config: ConfigService,
  ) {
    this.concurrency = this.config.get<number>('app.healthCheck.concurrency', 10);
    this.autoDisableAfter = this.config.get<number>('app.healthCheck.autoDisableAfter', 5);
  }

  /**
   * Check health of channels for a specific playlist
   */
  async checkPlaylist(playlistId: string): Promise<{ checked: number; working: number; dead: number }> {
    const channels = await this.prisma.channel.findMany({
      where: { playlistId, isEnabled: true },
      select: { id: true, streamUrl: true, failureCount: true },
    });

    this.logger.log(`Health checking ${channels.length} channels for playlist ${playlistId}`);
    return this.checkChannelsBatch(channels);
  }

  /**
   * Check health of all enabled channels across all playlists
   */
  async checkAll(): Promise<{ checked: number; working: number; dead: number }> {
    const channels = await this.prisma.channel.findMany({
      where: { isEnabled: true },
      select: { id: true, streamUrl: true, failureCount: true },
    });

    this.logger.log(`Health checking all ${channels.length} channels`);
    return this.checkChannelsBatch(channels);
  }

  /**
   * Check a single channel's stream health
   */
  async checkChannel(channelId: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id: channelId },
      select: { id: true, streamUrl: true, failureCount: true },
    });

    if (!channel) return null;
    return this.checkSingleStream(channel);
  }

  /**
   * Process channels in batches with concurrency control
   */
  private async checkChannelsBatch(
    channels: Array<{ id: string; streamUrl: string; failureCount: number }>,
  ) {
    let checked = 0;
    let working = 0;
    let dead = 0;

    // Process in concurrent batches
    for (let i = 0; i < channels.length; i += this.concurrency) {
      const batch = channels.slice(i, i + this.concurrency);
      const results = await Promise.allSettled(
        batch.map((ch) => this.checkSingleStream(ch)),
      );

      for (const result of results) {
        checked++;
        if (result.status === 'fulfilled' && result.value) {
          if (result.value.healthStatus === 'WORKING' || result.value.healthStatus === 'SLOW') {
            working++;
          } else {
            dead++;
          }
        } else {
          dead++;
        }
      }

      // Small delay between batches to avoid overwhelming the system
      if (i + this.concurrency < channels.length) {
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    this.logger.log(`Health check complete: ${checked} checked, ${working} working, ${dead} dead`);
    return { checked, working, dead };
  }

  /**
   * Check a single stream URL using HEAD request, falling back to partial GET
   */
  private async checkSingleStream(
    channel: { id: string; streamUrl: string; failureCount: number },
  ) {
    let healthStatus: 'WORKING' | 'SLOW' | 'DEAD' | 'UNKNOWN' = 'UNKNOWN';
    let httpStatus: number | null = null;
    let responseTimeMs: number | null = null;
    let contentType: string | null = null;

    try {
      // Try HEAD first (lightest)
      let result = await this.fetcher.headCheck(channel.streamUrl);

      // Some servers don't support HEAD - fall back to partial GET
      if (!result.ok && result.status === 405) {
        result = await this.fetcher.partialGet(channel.streamUrl, 1024);
      }

      httpStatus = result.status || null;
      responseTimeMs = result.responseTimeMs || null;
      contentType = result.contentType || null;

      if (result.ok || (result.status && result.status >= 200 && result.status < 400)) {
        // Check if response time indicates slow stream
        if (responseTimeMs && responseTimeMs > 5000) {
          healthStatus = 'SLOW';
        } else {
          healthStatus = 'WORKING';
        }
      } else if (result.error?.includes('timed out')) {
        healthStatus = 'DEAD';
      } else if (result.error?.includes('SSRF_BLOCKED')) {
        healthStatus = 'UNKNOWN';
      } else {
        healthStatus = 'DEAD';
      }
    } catch {
      healthStatus = 'DEAD';
    }

    // Calculate new failure count
    let newFailureCount = channel.failureCount;
    if (healthStatus === 'DEAD') {
      newFailureCount++;
    } else if (healthStatus === 'WORKING') {
      newFailureCount = 0;
    }

    // Auto-disable if too many failures
    const shouldDisable = newFailureCount >= this.autoDisableAfter;

    await this.prisma.channel.update({
      where: { id: channel.id },
      data: {
        healthStatus,
        lastCheckedAt: new Date(),
        failureCount: newFailureCount,
        httpStatus,
        responseTimeMs,
        contentType,
        isEnabled: shouldDisable ? false : undefined,
      },
    });

    if (shouldDisable) {
      this.logger.warn(`Auto-disabled channel ${channel.id} after ${newFailureCount} failures`);
    }

    return { channelId: channel.id, healthStatus, httpStatus, responseTimeMs };
  }
}
