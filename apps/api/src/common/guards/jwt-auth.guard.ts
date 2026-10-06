import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AppException } from '../app-exception';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthUser } from '../decorators/current-user.decorator';

interface AccessPayload {
  sub: string;
}

/**
 * Global guard. Rejects requests without a valid access token, then loads the
 * user and attaches it to `req.user`. Routes marked `@Public()` are skipped.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context
      .switchToHttp()
      .getRequest<Request & { user: AuthUser }>();
    const header = req.headers.authorization ?? '';
    const [scheme, bearerToken] = header.split(' ');
    const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
    const token = scheme === 'Bearer' && bearerToken ? bearerToken : queryToken;
    if (!token) {
      throw new AppException('UNAUTHENTICATED', 'Missing bearer token');
    }

    let payload: AccessPayload;
    try {
      payload = await this.jwt.verifyAsync<AccessPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
    } catch (err) {
      const expired = err instanceof Error && err.name === 'TokenExpiredError';
      throw new AppException(
        expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
        expired ? 'Access token expired' : 'Invalid access token',
      );
    }

    const user = await this.prisma.user.findFirst({
      where: { id: payload.sub, deletedAt: null },
      select: { id: true, email: true, name: true, role: true, status: true },
    });
    if (!user) {
      throw new AppException('UNAUTHENTICATED', 'Account no longer exists');
    }
    if (user.status === UserStatus.DISABLED) {
      throw new AppException('ACCOUNT_DISABLED', 'Account is disabled');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException('ACCOUNT_PENDING', 'Account is not active');
    }

    req.user = user;
    return true;
  }
}
