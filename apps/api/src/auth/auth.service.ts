import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AppException } from '../common/app-exception';
import { TokenService } from './token.service';
import {
  ForgotPasswordDto,
  GoogleLoginDto,
  LoginDto,
  RegisterDto,
  ResendOtpDto,
  ResetPasswordDto,
  VerifyOtpDto,
} from './dto/auth.dto';

const BCRYPT_ROUNDS = 10;

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  status: UserStatus;
  emailVerifiedAt: Date | null;
  createdAt: Date;
}

function toPublicUser(u: User): PublicUser {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    status: u.status,
    emailVerifiedAt: u.emailVerifiedAt,
    createdAt: u.createdAt,
  };
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger('Auth');
  private readonly googleClient: OAuth2Client;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {
    this.googleClient = new OAuth2Client(
      this.config.get<string>('GOOGLE_CLIENT_ID'),
    );
  }

  async register(dto: RegisterDto): Promise<{ message: string }> {
    const email = dto.email.toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppException('CONFLICT', 'Email is already registered');
    }
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        passwordHash: await bcrypt.hash(dto.password, BCRYPT_ROUNDS),
        status: UserStatus.PENDING,
      },
    });
    const code = await this.tokens.issueOtp(user.id);
    await this.mail.sendVerifyOtp(user.email, user.name, code);
    return {
      message:
        'Registered. Check your email for the verification code, then wait for a manager to approve your account.',
    };
  }

  async verifyOtp(dto: VerifyOtpDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });
    if (!user) {
      throw new AppException('TOKEN_INVALID', 'Incorrect code');
    }
    await this.tokens.verifyOtp(user.id, dto.code);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { emailVerifiedAt: new Date() },
    });
    return { message: 'Email verified. A manager will approve your account.' };
  }

  async resendOtp(dto: ResendOtpDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });
    if (user && !user.emailVerifiedAt) {
      const code = await this.tokens.issueOtp(user.id);
      await this.mail.sendVerifyOtp(user.email, user.name, code);
    } else {
      this.logger.warn(`resend-otp for unknown/verified email ${dto.email}`);
    }
    return {
      message: 'If that email needs verification, a new code has been sent.',
    };
  }

  async login(dto: LoginDto): Promise<{
    accessToken: string;
    refreshToken: string;
    user: PublicUser;
  }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });
    const ok =
      user?.passwordHash &&
      (await bcrypt.compare(dto.password, user.passwordHash));
    if (!user || !ok) {
      throw new AppException('UNAUTHENTICATED', 'Invalid email or password');
    }
    if (!user.emailVerifiedAt) {
      throw new AppException('EMAIL_NOT_VERIFIED', 'Email not verified');
    }
    if (user.status === UserStatus.PENDING) {
      throw new AppException(
        'ACCOUNT_PENDING',
        'Account awaiting manager approval',
      );
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException('ACCOUNT_DISABLED', 'Account is disabled');
    }
    return {
      accessToken: await this.tokens.signAccessToken(user.id),
      refreshToken: await this.tokens.issueRefreshToken(user.id),
      user: toPublicUser(user),
    };
  }

  async googleLogin(
    dto: GoogleLoginDto,
  ): Promise<
    | { accessToken: string; refreshToken: string; user: PublicUser }
    | { otpRequired: true; email: string }
  > {
    let payload: {
      email?: string;
      name?: string;
      sub: string;
      email_verified?: boolean;
    };
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: dto.idToken,
        audience: this.config.get<string>('GOOGLE_CLIENT_ID'),
      });
      const p = ticket.getPayload();
      if (!p) throw new Error('empty payload');
      payload = p;
    } catch {
      throw new AppException('UNAUTHENTICATED', 'Invalid Google token');
    }
    if (!payload.email || !payload.email_verified) {
      throw new AppException('UNAUTHENTICATED', 'Google email not verified');
    }
    const email = payload.email.toLowerCase();
    const name = payload.name ?? email;

    let user = await this.prisma.user.findFirst({
      where: { googleId: payload.sub, deletedAt: null },
    });
    if (!user) {
      const byEmail = await this.prisma.user.findFirst({
        where: { email, deletedAt: null },
      });
      if (byEmail) {
        user = await this.prisma.user.update({
          where: { id: byEmail.id },
          data: {
            googleId: payload.sub,
            emailVerifiedAt: byEmail.emailVerifiedAt ?? new Date(),
          },
        });
      } else {
        // email/googleId are unique across ALL rows (soft-deleted ones keep
        // the row, see users.service.ts `remove`), so a deleted account's
        // email still occupies the column — creating here would crash on
        // the DB unique constraint. Check first and fail with a clear error.
        const deletedCollision = await this.prisma.user.findFirst({
          where: {
            deletedAt: { not: null },
            OR: [{ email }, { googleId: payload.sub }],
          },
        });
        if (deletedCollision) {
          throw new AppException(
            'ACCOUNT_DISABLED',
            'This account has been removed. Contact a manager.',
          );
        }
        user = await this.prisma.user.create({
          data: {
            name,
            email,
            passwordHash: null,
            googleId: payload.sub,
            status: UserStatus.PENDING,
          },
        });
      }
    }

    if (!user.emailVerifiedAt) {
      // Brand-new Google sign-in (or a previous attempt that never
      // finished the OTP step) — Google proves the account is real, but
      // we still run it through the same OTP confirmation as manual
      // registration for a consistent verify-then-approve flow, minus
      // having to type name/email by hand.
      const code = await this.tokens.issueOtp(user.id);
      await this.mail.sendVerifyOtp(user.email, user.name, code);
      return { otpRequired: true, email: user.email };
    }
    if (user.status === UserStatus.PENDING) {
      throw new AppException(
        'ACCOUNT_PENDING',
        'Account awaiting manager approval',
      );
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new AppException('ACCOUNT_DISABLED', 'Account is disabled');
    }
    return {
      accessToken: await this.tokens.signAccessToken(user.id),
      refreshToken: await this.tokens.issueRefreshToken(user.id),
      user: toPublicUser(user),
    };
  }

  async refresh(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const userId = await this.tokens.consumeRefreshToken(refreshToken);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      await this.tokens.revokeAllRefreshTokens(userId);
      throw new AppException('UNAUTHENTICATED', 'Account is not active');
    }
    return {
      accessToken: await this.tokens.signAccessToken(user.id),
      refreshToken: await this.tokens.issueRefreshToken(user.id),
    };
  }

  async logout(refreshToken: string): Promise<{ message: string }> {
    await this.tokens.revokeRefreshToken(refreshToken);
    return { message: 'Logged out' };
  }

  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { email: dto.email.toLowerCase(), deletedAt: null },
    });
    if (user) {
      const token = await this.tokens.issueAuthToken(user.id, 'RESET_PASSWORD');
      await this.mail.sendResetPassword(user.email, user.name, token);
    } else {
      this.logger.warn(`forgot-password for unknown email ${dto.email}`);
    }
    return {
      message: 'If that email exists, a reset link has been sent.',
    };
  }

  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const userId = await this.tokens.consumeAuthToken(
      dto.token,
      'RESET_PASSWORD',
    );
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS),
      },
    });
    await this.tokens.revokeAllRefreshTokens(userId);
    return { message: 'Password updated. Please log in again.' };
  }

  async me(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, deletedAt: null },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found');
    return toPublicUser(user);
  }
}
