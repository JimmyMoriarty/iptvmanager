// =====================================================
// Audit Log Service
// =====================================================

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditContext {
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(
    action: string,
    resource: string,
    context: AuditContext,
    resourceId?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: context.userId,
          action,
          resource,
          resourceId,
          details: details ? JSON.parse(JSON.stringify(details)) : undefined,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
        },
      });
    } catch (err) {
      // Never let audit logging break the main flow
      this.logger.error(`Failed to write audit log: ${(err as Error).message}`);
    }
  }

  async getRecentLogs(limit = 50, offset = 0) {
    return this.prisma.auditLog.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { username: true } },
      },
    });
  }

  async getLogsByUser(userId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' },
    });
  }

  async cleanup(daysToKeep = 90): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);

    const result = await this.prisma.auditLog.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });

    this.logger.log(`Cleaned up ${result.count} audit logs older than ${daysToKeep} days`);
    return result.count;
  }
}
