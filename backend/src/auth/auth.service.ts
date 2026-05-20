// =====================================================
// Auth Service - Core authentication logic
// =====================================================

import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { OTPAuth } from 'otpauth';
import * as QRCode from 'qrcode';
import { LoginDto, ChangePasswordDto, CreateUserDto } from './dto/auth.dto';

// Use namespace import for otpauth
import * as OTPAuthLib from 'otpauth';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  type: 'access' | 'refresh';
}

interface RequestContext {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  // ---- Login ----

  async login(dto: LoginDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    if (!user) {
      await this.recordLoginAttempt(null, ctx, 'FAILED_PASSWORD', 'User not found');
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lock
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await this.recordLoginAttempt(user.id, ctx, 'ACCOUNT_LOCKED');
      const remainingSeconds = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 1000);
      throw new ForbiddenException(
        `Account locked. Try again in ${remainingSeconds} seconds.`,
      );
    }

    // Check account active
    if (!user.isActive) {
      await this.recordLoginAttempt(user.id, ctx, 'ACCOUNT_DISABLED');
      throw new ForbiddenException('Account is disabled');
    }

    // Verify password
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      await this.handleFailedLogin(user.id, ctx);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check TOTP
    if (user.totpEnabled) {
      if (!dto.totpCode) {
        // Password correct but TOTP needed - return partial auth
        return {
          requiresTotp: true,
          totpSetupRequired: false,
          accessToken: '',
          expiresIn: 0,
          tokenType: 'Bearer',
        };
      }

      const totpValid = this.verifyTotp(user.totpSecret!, dto.totpCode);
      if (!totpValid) {
        await this.recordLoginAttempt(user.id, ctx, 'FAILED_TOTP');
        await this.incrementFailedLogins(user.id);
        throw new UnauthorizedException('Invalid TOTP code');
      }
    } else if (!user.totpEnabled) {
      // TOTP not set up - user must set it up
      const tempToken = await this.generateTempToken(user.id);
      return {
        requiresTotp: false,
        totpSetupRequired: true,
        accessToken: tempToken,
        expiresIn: 300,
        tokenType: 'Bearer',
      };
    }

    // Login successful - generate tokens
    return this.completeLogin(user.id, user.username, user.role, ctx);
  }

  // ---- Complete login after password + TOTP ----

  private async completeLogin(
    userId: string,
    username: string,
    role: string,
    ctx: RequestContext,
  ) {
    // Reset failed login counter
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        failedLogins: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ctx.ipAddress,
      },
    });

    // Generate tokens
    const accessToken = await this.generateAccessToken(userId, username, role);
    const refreshToken = await this.generateRefreshToken(userId, username, role);

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId,
        refreshToken: await bcrypt.hash(refreshToken, 10),
        userAgent: ctx.userAgent.substring(0, 512),
        ipAddress: ctx.ipAddress,
        expiresAt,
      },
    });

    // Record success
    await this.recordLoginAttempt(userId, ctx, 'SUCCESS');
    await this.audit.log('LOGIN', 'auth', { userId, ...ctx });

    return {
      requiresTotp: false,
      totpSetupRequired: false,
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
      tokenType: 'Bearer',
    };
  }

  // ---- Refresh Token ----

  async refreshTokens(refreshToken: string, ctx: RequestContext) {
    let payload: JwtPayload;
    try {
      payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find matching session
    const sessions = await this.prisma.session.findMany({
      where: { userId: payload.sub, expiresAt: { gt: new Date() } },
    });

    let matchedSession = null;
    for (const session of sessions) {
      if (await bcrypt.compare(refreshToken, session.refreshToken)) {
        matchedSession = session;
        break;
      }
    }

    if (!matchedSession) {
      // Possible token theft - revoke all sessions
      await this.prisma.session.deleteMany({ where: { userId: payload.sub } });
      this.logger.warn(`Possible token theft detected for user ${payload.sub}`);
      await this.audit.log('TOKEN_THEFT_DETECTED', 'auth', {
        userId: payload.sub,
        ...ctx,
      });
      throw new UnauthorizedException('Session invalidated');
    }

    // Rotate refresh token
    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or disabled');
    }

    const newAccessToken = await this.generateAccessToken(user.id, user.username, user.role);
    const newRefreshToken = await this.generateRefreshToken(user.id, user.username, user.role);

    // Update session with new refresh token
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.update({
      where: { id: matchedSession.id },
      data: {
        refreshToken: await bcrypt.hash(newRefreshToken, 10),
        expiresAt,
        ipAddress: ctx.ipAddress,
        userAgent: ctx.userAgent.substring(0, 512),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  // ---- Logout ----

  async logout(userId: string, refreshToken: string | undefined, ctx: RequestContext) {
    if (refreshToken) {
      const sessions = await this.prisma.session.findMany({
        where: { userId },
      });

      for (const session of sessions) {
        if (await bcrypt.compare(refreshToken, session.refreshToken)) {
          await this.prisma.session.delete({ where: { id: session.id } });
          break;
        }
      }
    }

    await this.audit.log('LOGOUT', 'auth', { userId, ...ctx });
    return { message: 'Logged out successfully' };
  }

  async logoutAll(userId: string, ctx: RequestContext) {
    const result = await this.prisma.session.deleteMany({ where: { userId } });
    await this.audit.log('LOGOUT_ALL', 'auth', { userId, ...ctx }, undefined, {
      sessionsRevoked: result.count,
    });
    return { message: `Revoked ${result.count} sessions` };
  }

  // ---- TOTP Setup ----

  async generateTotpSetup(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const secret = new OTPAuthLib.Secret({ size: 20 });
    const totp = new OTPAuthLib.TOTP({
      issuer: this.config.get<string>('app.totp.issuer', 'IPTVManager'),
      label: user.username,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    const otpauthUrl = totp.toString();
    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Encrypt and store the secret temporarily
    const encryptedSecret = this.encryptTotpSecret(secret.base32);
    await this.redis.set(`totp_setup:${userId}`, encryptedSecret, 300); // 5 min TTL

    return {
      qrCode: qrCodeDataUrl,
      secret: secret.base32,
      otpauthUrl,
    };
  }

  async confirmTotpSetup(userId: string, code: string, ctx: RequestContext) {
    const encryptedSecret = await this.redis.get(`totp_setup:${userId}`);
    if (!encryptedSecret) {
      throw new BadRequestException('TOTP setup expired. Please generate a new QR code.');
    }

    const secret = this.decryptTotpSecret(encryptedSecret);

    // Verify the code
    const totp = new OTPAuthLib.TOTP({
      secret: OTPAuthLib.Secret.fromBase32(secret),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      throw new BadRequestException('Invalid TOTP code');
    }

    // Save encrypted secret to user
    const encryptedForStorage = this.encryptTotpSecret(secret);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        totpSecret: encryptedForStorage,
        totpEnabled: true,
      },
    });

    // Clean up temp storage
    await this.redis.del(`totp_setup:${userId}`);

    await this.audit.log('TOTP_ENABLED', 'auth', { userId, ...ctx });

    // Now complete login
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    return this.completeLogin(user!.id, user!.username, user!.role, ctx);
  }

  async disableTotp(userId: string, password: string, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Invalid password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: null, totpEnabled: false },
    });

    await this.audit.log('TOTP_DISABLED', 'auth', { userId, ...ctx });
    return { message: 'TOTP disabled' };
  }

  // ---- Password Management ----

  async changePassword(userId: string, dto: ChangePasswordDto, ctx: RequestContext) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('User not found');

    const passwordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('Current password is incorrect');

    const rounds = this.config.get<number>('app.security.bcryptRounds', 12);
    const newHash = await bcrypt.hash(dto.newPassword, rounds);

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: newHash },
    });

    // Revoke all sessions except current
    await this.prisma.session.deleteMany({ where: { userId } });

    await this.audit.log('PASSWORD_CHANGED', 'auth', { userId, ...ctx });
    return { message: 'Password changed. Please log in again.' };
  }

  // ---- User Management ----

  async createUser(dto: CreateUserDto, ctx: RequestContext) {
    const existing = await this.prisma.user.findFirst({
      where: {
        OR: [{ username: dto.username }, { email: dto.email }],
      },
    });

    if (existing) {
      throw new ConflictException('Username or email already exists');
    }

    const rounds = this.config.get<number>('app.security.bcryptRounds', 12);
    const passwordHash = await bcrypt.hash(dto.password, rounds);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
        role: 'ADMIN',
      },
      select: { id: true, username: true, email: true, role: true, createdAt: true },
    });

    await this.audit.log('USER_CREATED', 'users', { ...ctx }, user.id);
    return user;
  }

  // ---- Session Management ----

  async getSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(userId: string, sessionId: string, ctx: RequestContext) {
    await this.prisma.session.deleteMany({
      where: { id: sessionId, userId },
    });
    await this.audit.log('SESSION_REVOKED', 'auth', { userId, ...ctx }, sessionId);
    return { message: 'Session revoked' };
  }

  // ---- Login History ----

  async getLoginHistory(userId: string, limit = 20) {
    return this.prisma.loginHistory.findMany({
      where: { userId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        ipAddress: true,
        userAgent: true,
        status: true,
        reason: true,
        createdAt: true,
      },
    });
  }

  // ---- Profile ----

  async getProfile(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        role: true,
        totpEnabled: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
      },
    });
  }

  // ---- Validate access token (for guard) ----

  async validateUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) return null;
    return user;
  }

  // ---- Private Helpers ----

  private async generateAccessToken(userId: string, username: string, role: string): Promise<string> {
    return this.jwt.sign(
      { sub: userId, username, role, type: 'access' },
      {
        secret: this.config.get<string>('app.jwt.accessSecret'),
        expiresIn: this.config.get<string>('app.jwt.accessExpiry', '15m'),
      },
    );
  }

  private async generateRefreshToken(userId: string, username: string, role: string): Promise<string> {
    return this.jwt.sign(
      { sub: userId, username, role, type: 'refresh' },
      {
        secret: this.config.get<string>('app.jwt.refreshSecret'),
        expiresIn: this.config.get<string>('app.jwt.refreshExpiry', '7d'),
      },
    );
  }

  private async generateTempToken(userId: string): Promise<string> {
    return this.jwt.sign(
      { sub: userId, type: 'totp_setup' },
      {
        secret: this.config.get<string>('app.jwt.accessSecret'),
        expiresIn: '5m',
      },
    );
  }

  private verifyTotp(encryptedSecret: string, code: string): boolean {
    try {
      const secret = this.decryptTotpSecret(encryptedSecret);
      const totp = new OTPAuthLib.TOTP({
        secret: OTPAuthLib.Secret.fromBase32(secret),
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
      });

      const delta = totp.validate({ token: code, window: 1 });
      return delta !== null;
    } catch {
      return false;
    }
  }

  private encryptTotpSecret(secret: string): string {
    const key = this.config.get<string>('app.totp.encryptionKey', '');
    const keyBuffer = Buffer.from(key, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted.toString('hex');
  }

  private decryptTotpSecret(encryptedData: string): string {
    const key = this.config.get<string>('app.totp.encryptionKey', '');
    const keyBuffer = Buffer.from(key, 'hex');
    const parts = encryptedData.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
  }

  private async handleFailedLogin(userId: string, ctx: RequestContext): Promise<void> {
    await this.recordLoginAttempt(userId, ctx, 'FAILED_PASSWORD');
    await this.incrementFailedLogins(userId);
  }

  private async incrementFailedLogins(userId: string): Promise<void> {
    const maxAttempts = this.config.get<number>('app.security.loginMaxAttempts', 5);
    const lockDuration = this.config.get<number>('app.security.loginLockDuration', 900);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { failedLogins: { increment: 1 } },
    });

    if (user.failedLogins >= maxAttempts) {
      const lockedUntil = new Date(Date.now() + lockDuration * 1000);
      await this.prisma.user.update({
        where: { id: userId },
        data: { lockedUntil, failedLogins: 0 },
      });
      this.logger.warn(`Account locked: ${userId} until ${lockedUntil.toISOString()}`);
    }
  }

  private async recordLoginAttempt(
    userId: string | null,
    ctx: RequestContext,
    status: string,
    reason?: string,
  ): Promise<void> {
    if (!userId) return;
    try {
      await this.prisma.loginHistory.create({
        data: {
          userId,
          ipAddress: ctx.ipAddress,
          userAgent: ctx.userAgent.substring(0, 512),
          status: status as any,
          reason,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to record login attempt: ${(err as Error).message}`);
    }
  }
}
