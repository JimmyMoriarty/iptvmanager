// =====================================================
// Queue Scheduler - Cron-based background tasks
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PlaylistService } from '../playlist/playlist.service';
import { HealthCheckService } from '../health-check/health-check.service';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class QueueScheduler {
  private readonly logger = new Logger(QueueScheduler.name);
  private isRefreshing = false;
  private isHealthChecking = false;

  constructor(
    private readonly playlists: PlaylistService,
    private readonly healthCheck: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Refresh playlists that are due - runs every 30 minutes
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async refreshPlaylists(): Promise<void> {
    if (this.isRefreshing) {
      this.logger.warn('Playlist refresh already in progress, skipping');
      return;
    }

    this.isRefreshing = true;
    try {
      const ids = await this.playlists.getPlaylistsDueForRefresh();
      if (ids.length === 0) {
        this.logger.debug('No playlists due for refresh');
        return;
      }

      this.logger.log(`Refreshing ${ids.length} playlists`);

      for (const id of ids) {
        try {
          await this.playlists.fetchAndSync(id);
        } catch (err) {
          this.logger.error(`Failed to refresh playlist ${id}: ${(err as Error).message}`);
        }
        // Small delay between refreshes
        await new Promise((r) => setTimeout(r, 2000));
      }

      this.logger.log('Playlist refresh cycle complete');
    } finally {
      this.isRefreshing = false;
    }
  }

  /**
   * Health check all enabled channels - runs every hour
   */
  @Cron(CronExpression.EVERY_HOUR)
  async runHealthChecks(): Promise<void> {
    if (this.isHealthChecking) {
      this.logger.warn('Health check already in progress, skipping');
      return;
    }

    this.isHealthChecking = true;
    try {
      this.logger.log('Starting health check cycle');
      const result = await this.healthCheck.checkAll();
      this.logger.log(
        `Health check complete: ${result.checked} checked, ` +
        `${result.working} working, ${result.dead} dead`,
      );
    } catch (err) {
      this.logger.error(`Health check failed: ${(err as Error).message}`);
    } finally {
      this.isHealthChecking = false;
    }
  }

  /**
   * Cleanup expired sessions and old logs - runs daily at 3 AM
   */
  @Cron('0 3 * * *')
  async cleanup(): Promise<void> {
    this.logger.log('Running cleanup tasks');

    try {
      // Delete expired sessions
      const sessions = await this.prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
      this.logger.log(`Cleaned up ${sessions.count} expired sessions`);

      // Delete old login history (90 days)
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const history = await this.prisma.loginHistory.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      this.logger.log(`Cleaned up ${history.count} old login history entries`);

      // Delete old audit logs (90 days)
      const audits = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: cutoff } },
      });
      this.logger.log(`Cleaned up ${audits.count} old audit logs`);
    } catch (err) {
      this.logger.error(`Cleanup failed: ${(err as Error).message}`);
    }
  }

  /**
   * Clear stale output cache - runs every 10 minutes
   */
  @Cron(CronExpression.EVERY_10_MINUTES)
  async clearStaleCache(): Promise<void> {
    // Redis handles TTL automatically, this is just for safety
    this.logger.debug('Cache maintenance check');
  }
}
