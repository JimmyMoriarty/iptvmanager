// =====================================================
// Channel Service - Browse, search, filter channels
// =====================================================

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

export interface ChannelQueryDto {
  search?: string;
  playlistId?: string;
  groupTitle?: string;
  healthStatus?: string;
  isEnabled?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ChannelService {
  private readonly logger = new Logger(ChannelService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ChannelQueryDto) {
    const page = query.page || 1;
    const limit = Math.min(query.limit || 50, 200);
    const skip = (page - 1) * limit;

    const where: Prisma.ChannelWhereInput = {};

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { tvgName: { contains: query.search, mode: 'insensitive' } },
        { groupTitle: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.playlistId) where.playlistId = query.playlistId;
    if (query.groupTitle) where.groupTitle = query.groupTitle;
    if (query.healthStatus) where.healthStatus = query.healthStatus as any;
    if (query.isEnabled !== undefined) where.isEnabled = query.isEnabled;

    const orderBy: Prisma.ChannelOrderByWithRelationInput = {};
    const sortField = query.sortBy || 'name';
    const sortDir = query.sortOrder || 'asc';
    (orderBy as any)[sortField] = sortDir;

    const [channels, total] = await Promise.all([
      this.prisma.channel.findMany({
        where, skip, take: limit, orderBy,
        select: {
          id: true, name: true, streamUrl: true, groupTitle: true,
          tvgId: true, tvgName: true, tvgLogo: true,
          isEnabled: true, healthStatus: true, lastCheckedAt: true,
          failureCount: true, httpStatus: true, responseTimeMs: true,
          playlist: { select: { id: true, name: true } },
        },
      }),
      this.prisma.channel.count({ where }),
    ]);

    return {
      data: channels,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string) {
    const channel = await this.prisma.channel.findUnique({
      where: { id },
      include: { playlist: { select: { id: true, name: true } } },
    });
    if (!channel) throw new NotFoundException('Channel not found');
    return channel;
  }

  async toggleEnabled(id: string, enabled: boolean) {
    return this.prisma.channel.update({
      where: { id },
      data: { isEnabled: enabled },
    });
  }

  async bulkToggle(ids: string[], enabled: boolean) {
    return this.prisma.channel.updateMany({
      where: { id: { in: ids } },
      data: { isEnabled: enabled },
    });
  }

  async getGroups(playlistId?: string) {
    const where: Prisma.ChannelWhereInput = {};
    if (playlistId) where.playlistId = playlistId;

    const groups = await this.prisma.channel.groupBy({
      by: ['groupTitle'],
      where,
      _count: { id: true },
      orderBy: { groupTitle: 'asc' },
    });

    return groups.map((g) => ({
      name: g.groupTitle || 'Uncategorized',
      count: g._count.id,
    }));
  }

  async getHealthStats(playlistId?: string) {
    const where: Prisma.ChannelWhereInput = {};
    if (playlistId) where.playlistId = playlistId;

    const stats = await this.prisma.channel.groupBy({
      by: ['healthStatus'],
      where,
      _count: { id: true },
    });

    const result: Record<string, number> = {
      WORKING: 0, SLOW: 0, DEAD: 0, UNKNOWN: 0,
    };
    stats.forEach((s) => { result[s.healthStatus] = s._count.id; });
    return result;
  }
}
