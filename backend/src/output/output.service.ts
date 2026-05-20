// =====================================================
// Generated Output Service
// =====================================================
// Creates dynamic M3U playlists from combined sources.
// Generated playlists contain ORIGINAL stream URLs only.
// NEVER rewrites URLs through this server.
// =====================================================

import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { M3uParserService, ParsedChannel } from '../parser/m3u-parser.service';
import { AuditService, AuditContext } from '../audit/audit.service';
import * as crypto from 'crypto';

export interface CreateOutputDto {
  name: string;
  slug?: string;
  description?: string;
  sourcePlaylistIds: string[];
  filterGroups?: string[];
  filterSearch?: string;
  excludeGroups?: string[];
  excludeDead?: boolean;
  sortOrder?: 'NAME_ASC' | 'NAME_DESC' | 'GROUP_ASC' | 'GROUP_DESC' | 'ORIGINAL';
  maxChannels?: number;
  epgUrl?: string;
}

export interface UpdateOutputDto {
  name?: string;
  description?: string;
  sourcePlaylistIds?: string[];
  filterGroups?: string[];
  filterSearch?: string;
  excludeGroups?: string[];
  excludeDead?: boolean;
  sortOrder?: string;
  maxChannels?: number;
  epgUrl?: string;
  isEnabled?: boolean;
}

@Injectable()
export class OutputService {
  private readonly logger = new Logger(OutputService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly parser: M3uParserService,
    private readonly audit: AuditService,
  ) {}

  // ---- Create Output ----

  async create(dto: CreateOutputDto, ctx: AuditContext) {
    const slug = dto.slug || this.generateSlug(dto.name);
    const token = this.generateToken();

    const output = await this.prisma.generatedOutput.create({
      data: {
        name: dto.name,
        slug,
        token,
        description: dto.description,
        filterGroups: dto.filterGroups || [],
        filterSearch: dto.filterSearch,
        excludeGroups: dto.excludeGroups || [],
        excludeDead: dto.excludeDead ?? true,
        sortOrder: (dto.sortOrder as any) || 'NAME_ASC',
        maxChannels: dto.maxChannels,
        epgUrl: dto.epgUrl,
        sources: {
          create: dto.sourcePlaylistIds.map((pid, i) => ({
            playlistId: pid,
            priority: i,
          })),
        },
      },
      include: { sources: { include: { playlist: { select: { name: true } } } } },
    });

    await this.audit.log('OUTPUT_CREATED', 'outputs', ctx, output.id);
    return output;
  }

  // ---- Find All ----

  async findAll() {
    return this.prisma.generatedOutput.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        sources: {
          include: { playlist: { select: { id: true, name: true } } },
          orderBy: { priority: 'asc' },
        },
        _count: true,
      },
    });
  }

  // ---- Find One ----

  async findOne(id: string) {
    const output = await this.prisma.generatedOutput.findUnique({
      where: { id },
      include: {
        sources: {
          include: { playlist: { select: { id: true, name: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    });
    if (!output) throw new NotFoundException('Output not found');
    return output;
  }

  // ---- Update ----

  async update(id: string, dto: UpdateOutputDto, ctx: AuditContext) {
    const existing = await this.prisma.generatedOutput.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Output not found');

    if (dto.sourcePlaylistIds) {
      await this.prisma.outputSource.deleteMany({ where: { outputId: id } });
      await this.prisma.outputSource.createMany({
        data: dto.sourcePlaylistIds.map((pid, i) => ({
          outputId: id, playlistId: pid, priority: i,
        })),
      });
    }

    const { sourcePlaylistIds: _, ...updateData } = dto;
    const output = await this.prisma.generatedOutput.update({
      where: { id },
      data: updateData as any,
      include: { sources: { include: { playlist: { select: { name: true } } } } },
    });

    await this.redis.del(`output:${existing.token}`);
    await this.audit.log('OUTPUT_UPDATED', 'outputs', ctx, id);
    return output;
  }

  // ---- Delete ----

  async remove(id: string, ctx: AuditContext) {
    const existing = await this.prisma.generatedOutput.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Output not found');

    await this.prisma.generatedOutput.delete({ where: { id } });
    await this.redis.del(`output:${existing.token}`);
    await this.audit.log('OUTPUT_DELETED', 'outputs', ctx, id);
    return { message: 'Output deleted' };
  }

  // ---- Regenerate Token ----

  async regenerateToken(id: string, ctx: AuditContext) {
    const existing = await this.prisma.generatedOutput.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Output not found');

    const newToken = this.generateToken();
    await this.prisma.generatedOutput.update({
      where: { id },
      data: { token: newToken },
    });

    await this.redis.del(`output:${existing.token}`);
    await this.audit.log('OUTPUT_TOKEN_REGENERATED', 'outputs', ctx, id);
    return { token: newToken };
  }

  // ---- Generate M3U Playlist (public endpoint) ----

  async generatePlaylist(token: string, clientIp?: string): Promise<string | null> {
    // Check cache first
    const cached = await this.redis.get(`output:${token}`);
    if (cached) {
      await this.updateAccessStats(token, clientIp);
      return cached;
    }

    const output = await this.prisma.generatedOutput.findUnique({
      where: { token },
      include: {
        sources: {
          include: { playlist: { select: { id: true } } },
          orderBy: { priority: 'asc' },
        },
      },
    });

    if (!output || !output.isEnabled) return null;

    // Check token expiry
    if (output.tokenExpiresAt && output.tokenExpiresAt < new Date()) {
      return null;
    }

    // Gather channels from all source playlists
    const playlistIds = output.sources.map((s) => s.playlistId);
    const whereClause: any = {
      playlistId: { in: playlistIds },
      isEnabled: true,
    };

    // Exclude dead channels if configured
    if (output.excludeDead) {
      whereClause.healthStatus = { not: 'DEAD' };
    }

    // Apply group filters
    if (output.filterGroups.length > 0) {
      whereClause.groupTitle = { in: output.filterGroups };
    }

    // Apply group exclusions
    if (output.excludeGroups.length > 0) {
      whereClause.NOT = { groupTitle: { in: output.excludeGroups } };
    }

    // Apply search filter
    if (output.filterSearch) {
      whereClause.OR = [
        { name: { contains: output.filterSearch, mode: 'insensitive' } },
        { tvgName: { contains: output.filterSearch, mode: 'insensitive' } },
      ];
    }

    // Determine sort
    let orderBy: any = { name: 'asc' };
    switch (output.sortOrder) {
      case 'NAME_DESC': orderBy = { name: 'desc' }; break;
      case 'GROUP_ASC': orderBy = [{ groupTitle: 'asc' }, { name: 'asc' }]; break;
      case 'GROUP_DESC': orderBy = [{ groupTitle: 'desc' }, { name: 'asc' }]; break;
      case 'ORIGINAL': orderBy = { createdAt: 'asc' }; break;
      default: orderBy = { name: 'asc' };
    }

    const channels = await this.prisma.channel.findMany({
      where: whereClause,
      orderBy,
      take: output.maxChannels || undefined,
      select: {
        name: true, streamUrl: true, groupTitle: true,
        tvgId: true, tvgName: true, tvgLogo: true,
        tvgCountry: true, tvgLanguage: true, duration: true,
      },
    });

    // Deduplicate by stream URL
    const seen = new Set<string>();
    const unique: ParsedChannel[] = [];
    for (const ch of channels) {
      const key = ch.streamUrl.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({
          name: ch.name,
          streamUrl: ch.streamUrl, // ORIGINAL URL - NEVER rewritten
          groupTitle: ch.groupTitle,
          tvgId: ch.tvgId,
          tvgName: ch.tvgName,
          tvgLogo: ch.tvgLogo,
          tvgCountry: ch.tvgCountry,
          tvgLanguage: ch.tvgLanguage,
          duration: ch.duration,
          rawExtinf: '',
        });
      }
    }

    const m3uContent = this.parser.generateM3u(unique, output.epgUrl || undefined);

    // Cache for 5 minutes
    await this.redis.set(`output:${token}`, m3uContent, 300);
    await this.updateAccessStats(token, clientIp);

    return m3uContent;
  }

  // ---- Helpers ----

  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 100);
  }

  private generateToken(): string {
    return crypto.randomBytes(24).toString('base64url');
  }

  private async updateAccessStats(token: string, clientIp?: string): Promise<void> {
    try {
      await this.prisma.generatedOutput.update({
        where: { token },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
          lastAccessIp: clientIp?.substring(0, 45),
        },
      });
    } catch {
      // Non-critical
    }
  }
}
