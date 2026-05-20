// =====================================================
// Auth Decorators
// =====================================================

import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';

// Mark route as public (no auth required)
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// Extract current user from request
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);

// Extract request context (IP, user agent)
export const RequestContext = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return {
      ipAddress: request.ip || request.headers['x-forwarded-for'] || '0.0.0.0',
      userAgent: request.headers['user-agent'] || 'Unknown',
    };
  },
);
