// =====================================================
// Auth Controller - Authentication endpoints
// =====================================================

import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Res,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Public, CurrentUser, RequestContext } from './decorators/public.decorator';
import {
  LoginDto,
  SetupTotpDto,
  ChangePasswordDto,
  CreateUserDto,
} from './dto/auth.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // ---- Login ----
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with username/password and optional TOTP' })
  @ApiResponse({ status: 200, description: 'Login successful or TOTP required' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked or disabled' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const result = await this.auth.login(dto, ctx);

    // Set refresh token as httpOnly secure cookie
    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/api/auth',
      });

      // Don't expose refresh token in response body
      const { refreshToken: _rt, ...response } = result;
      return response;
    }

    return result;
  }

  // ---- Refresh Token ----
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token using refresh token cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    if (!refreshToken) {
      return { error: 'No refresh token provided' };
    }

    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const result = await this.auth.refreshTokens(refreshToken, ctx);

    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/api/auth',
    });

    const { refreshToken: _rt, ...response } = result;
    return response;
  }

  // ---- Logout ----
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout current session' })
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const result = await this.auth.logout(userId, req.cookies?.refreshToken, ctx);

    res.clearCookie('refreshToken', { path: '/api/auth' });
    return result;
  }

  // ---- Logout All Sessions ----
  @UseGuards(JwtAuthGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke all sessions' })
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const result = await this.auth.logoutAll(userId, ctx);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    return result;
  }

  // ---- TOTP Setup ----
  @UseGuards(JwtAuthGuard)
  @Get('totp/setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate TOTP QR code for 2FA setup' })
  async totpSetup(@CurrentUser('id') userId: string) {
    return this.auth.generateTotpSetup(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Post('totp/confirm')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm TOTP setup with verification code' })
  async totpConfirm(
    @CurrentUser('id') userId: string,
    @Body() dto: SetupTotpDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };

    const result = await this.auth.confirmTotpSetup(userId, dto.totpCode, ctx);

    if (result.refreshToken) {
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        path: '/api/auth',
      });

      const { refreshToken: _rt, ...response } = result;
      return response;
    }

    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('totp/disable')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Disable TOTP 2FA (requires password)' })
  async totpDisable(
    @CurrentUser('id') userId: string,
    @Body('password') password: string,
    @Req() req: Request,
  ) {
    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };
    return this.auth.disableTotp(userId, password, ctx);
  }

  // ---- Password ----
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password' })
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
    @Req() req: Request,
  ) {
    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };
    return this.auth.changePassword(userId, dto, ctx);
  }

  // ---- Profile ----
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  async profile(@CurrentUser('id') userId: string) {
    return this.auth.getProfile(userId);
  }

  // ---- Sessions ----
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List active sessions' })
  async sessions(@CurrentUser('id') userId: string) {
    return this.auth.getSessions(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a specific session' })
  async revokeSession(
    @CurrentUser('id') userId: string,
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
  ) {
    const ctx = {
      ipAddress: (req.ip || req.headers['x-forwarded-for'] as string || '0.0.0.0'),
      userAgent: req.headers['user-agent'] || 'Unknown',
    };
    return this.auth.revokeSession(userId, sessionId, ctx);
  }

  // ---- Login History ----
  @UseGuards(JwtAuthGuard)
  @Get('login-history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get login history' })
  async loginHistory(@CurrentUser('id') userId: string) {
    return this.auth.getLoginHistory(userId);
  }
}
