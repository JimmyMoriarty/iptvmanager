// =====================================================
// Admin Controller - Dashboard stats and management
// =====================================================

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminService } from './admin.service';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  @ApiOperation({ summary: 'Get dashboard statistics' })
  async getStats() {
    return this.admin.getDashboardStats();
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get recent audit logs' })
  async getAuditLogs() {
    return this.admin.getAuditLogs();
  }

  @Get('system-info')
  @ApiOperation({ summary: 'Get system information' })
  async getSystemInfo() {
    return this.admin.getSystemInfo();
  }
}
