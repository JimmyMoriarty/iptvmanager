// =====================================================
// Playlist Controller
// =====================================================

import {
  Controller, Get, Post, Put, Delete, Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser, RequestContext } from '../auth/decorators/public.decorator';
import { PlaylistService } from './playlist.service';
import {
  CreatePlaylistDto, UpdatePlaylistDto, PlaylistQueryDto, BulkImportDto,
} from './dto/playlist.dto';

@ApiTags('Playlists')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('playlists')
export class PlaylistController {
  constructor(private readonly playlists: PlaylistService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new playlist' })
  async create(
    @Body() dto: CreatePlaylistDto,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.playlists.create(dto, userId, { userId, ...ctx });
  }

  @Get()
  @ApiOperation({ summary: 'List playlists with filters' })
  async findAll(@Query() query: PlaylistQueryDto) {
    return this.playlists.findAll(query);
  }

  @Get('tags')
  @ApiOperation({ summary: 'Get all unique tags' })
  async getTags() {
    return this.playlists.getAllTags();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get playlist by ID' })
  async findOne(@Param('id') id: string) {
    return this.playlists.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a playlist' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdatePlaylistDto,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.playlists.update(id, dto, { userId, ...ctx });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a playlist' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.playlists.remove(id, { userId, ...ctx });
  }

  @Post('bulk-import')
  @ApiOperation({ summary: 'Bulk import playlists' })
  async bulkImport(
    @Body() dto: BulkImportDto,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.playlists.bulkImport(dto, userId, { userId, ...ctx });
  }

  @Post(':id/sync')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Fetch and sync playlist channels' })
  async sync(@Param('id') id: string) {
    return this.playlists.fetchAndSync(id);
  }

  @Get(':id/export')
  @ApiOperation({ summary: 'Export playlist configuration' })
  async exportConfig(@Param('id') id: string) {
    return this.playlists.exportConfig(id);
  }
}
