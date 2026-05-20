// =====================================================
// Admin Service - Dashboard data aggregation
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import * as os from 'os';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async getDashboardStats() {
    const [
      totalPlaylists,
      enabledPlaylists,
      totalChannels,
      totalOutputs,
      healthStats,
      recentPlaylists,
    ] = await Promise.all([
      this.prisma.playlist.count(),
      this.prisma.playlist.count({ where: { isEnabled: true } }),
      this.prisma.channel.count(),
      this.prisma.generatedOutput.count(),
      this.prisma.channel.groupBy({
        by: ['healthStatus'],
        _count: { id: true },
      }),
      this.prisma.playlist.findMany({
        take: 5,
        orderBy: { lastFetchedAt: 'desc' },
        select: {
          id: true, name: true, channelCount: true,
          lastFetchedAt: true, lastFetchStatus: true,
        },
      }),
    ]);

    const health: Record<string, number> = {
      WORKING: 0, SLOW: 0, DEAD: 0, UNKNOWN: 0,
    };
    healthStats.forEach((s) => { health[s.healthStatus] = s._count.id; });

    return {
      playlists: { total: totalPlaylists, enabled: enabledPlaylists },
      channels: {
        total: totalChannels,
        ...health,
      },
      outputs: totalOutputs,
      recentPlaylists,
    };
  }

  async getAuditLogs(limit = 50) {
    return this.audit.getRecentLogs(limit);
  }

  async getSystemInfo() {
    const memUsage = process.memoryUsage();
    return {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      processMemory: {
        rss: memUsage.rss,
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
      },
    };
  }
}
