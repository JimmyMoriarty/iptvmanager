// =====================================================
// Channel Controller
// =====================================================

import {
  Controller, Get, Patch, Post, Param, Query, Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ChannelService, ChannelQueryDto } from './channel.service';

@ApiTags('Channels')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('channels')
export class ChannelController {
  constructor(private readonly channels: ChannelService) {}

  @Get()
  @ApiOperation({ summary: 'List channels with filters' })
  async findAll(@Query() query: ChannelQueryDto) {
    return this.channels.findAll(query);
  }

  @Get('groups')
  @ApiOperation({ summary: 'Get channel group names with counts' })
  async getGroups(@Query('playlistId') playlistId?: string) {
    return this.channels.getGroups(playlistId);
  }

  @Get('health-stats')
  @ApiOperation({ summary: 'Get health status statistics' })
  async healthStats(@Query('playlistId') playlistId?: string) {
    return this.channels.getHealthStats(playlistId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get channel details' })
  async findOne(@Param('id') id: string) {
    return this.channels.findOne(id);
  }

  @Patch(':id/toggle')
  @ApiOperation({ summary: 'Enable/disable a channel' })
  async toggle(@Param('id') id: string, @Body('enabled') enabled: boolean) {
    return this.channels.toggleEnabled(id, enabled);
  }

  @Post('bulk-toggle')
  @ApiOperation({ summary: 'Bulk enable/disable channels' })
  async bulkToggle(@Body() body: { ids: string[]; enabled: boolean }) {
    return this.channels.bulkToggle(body.ids, body.enabled);
  }
}
