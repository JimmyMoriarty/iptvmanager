// =====================================================
// Output Controller - Generated playlist endpoints
// =====================================================

import {
  Controller, Get, Post, Put, Delete, Body, Param, Req, Res,
  UseGuards, HttpCode, HttpStatus, Header,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Public, CurrentUser, RequestContext } from '../auth/decorators/public.decorator';
import { OutputService, CreateOutputDto, UpdateOutputDto } from './output.service';

@ApiTags('Outputs')
@Controller()
export class OutputController {
  constructor(private readonly outputs: OutputService) {}

  // ---- Public playlist endpoint (no auth) ----
  @Public()
  @Get('p/:token')
  @ApiOperation({ summary: 'Get generated M3U playlist by token' })
  async getPlaylist(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const clientIp = (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0');
    const content = await this.outputs.generatePlaylist(token, clientIp);

    if (!content) {
      res.status(404).send('Not Found');
      return;
    }

    // Set proper headers for M3U compatibility with all players
    res.setHeader('Content-Type', 'audio/x-mpegurl; charset=utf-8');
    res.setHeader('Content-Disposition', `inline; filename="${token}.m3u"`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.send(content);
  }

  // ---- Admin CRUD (auth required) ----
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('api/output')
  @ApiOperation({ summary: 'Create a generated output' })
  async create(
    @Body() dto: CreateOutputDto,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.outputs.create(dto, { userId, ...ctx });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('api/output')
  @ApiOperation({ summary: 'List all generated outputs' })
  async findAll() {
    return this.outputs.findAll();
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('api/output/:id')
  @ApiOperation({ summary: 'Get output details' })
  async findOne(@Param('id') id: string) {
    return this.outputs.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Put('api/output/:id')
  @ApiOperation({ summary: 'Update an output' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateOutputDto,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.outputs.update(id, dto, { userId, ...ctx });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete('api/output/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an output' })
  async remove(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.outputs.remove(id, { userId, ...ctx });
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post('api/output/:id/regenerate-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Regenerate output access token' })
  async regenerateToken(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @RequestContext() ctx: any,
  ) {
    return this.outputs.regenerateToken(id, { userId, ...ctx });
  }
}
