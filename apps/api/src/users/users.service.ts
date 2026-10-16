import { Injectable } from '@nestjs/common';
import { Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/app-exception';
import { PublicUser } from '../auth/auth.service';
import { TokenService } from '../auth/token.service';
import { MailService } from '../mail/mail.service';
import { AuditService } from '../audit/audit.service';
import { ListUsersQueryDto, UpdateUserDto } from './dto/users.dto';

const PUBLIC_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly mail: MailService,
    private readonly audit: AuditService,
  ) {}

  async list(q: ListUsersQueryDto): Promise<Paginated<PublicUser>> {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(q.status ? { status: q.status } : {}),
      ...(q.role ? { role: q.role } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  async get(id: string): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: PUBLIC_SELECT,
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found');
    return user;
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    actorId?: string,
  ): Promise<PublicUser> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found');

    if (dto.status === UserStatus.ACTIVE) {
      const role = dto.role ?? user.role;
      if (!role) {
        throw new AppException(
          'VALIDATION_ERROR',
          'A role is required to activate a user',
        );
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.role !== undefined ? { role: dto.role } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
      },
      select: PUBLIC_SELECT,
    });

    // Notify the user when a MANAGER approves their registration
    // (PENDING -> ACTIVE). Re-enabling a DISABLED account is a different
    // action and doesn't send this "you're approved" email.
    if (
      user.status === UserStatus.PENDING &&
      updated.status === UserStatus.ACTIVE
    ) {
      await this.mail.sendAccountApproved(updated.email, updated.name);
    }

    // Determine audit action & description
    let action = 'USER_UPDATE';
    let description = `Cập nhật thông tin tài khoản "${updated.name}" (${updated.email})`;
    if (
      user.status === UserStatus.PENDING &&
      updated.status === UserStatus.ACTIVE
    ) {
      action = 'USER_APPROVE';
      description = `Phê duyệt tài khoản người dùng "${updated.name}" (${updated.email}) với vai trò ${updated.role}`;
    } else if (dto.status === UserStatus.DISABLED) {
      action = 'USER_DISABLE';
      description = `Khóa tài khoản người dùng "${updated.name}" (${updated.email})`;
    } else if (dto.role && dto.role !== user.role) {
      action = 'USER_ROLE_ASSIGN';
      description = `Thay đổi vai trò người dùng "${updated.name}" (${updated.email}) thành ${dto.role}`;
    }

    await this.audit.record({
      actorId,
      action,
      entity: 'USER',
      entityId: updated.id,
      description,
      diff: {
        before: { name: user.name, role: user.role, status: user.status },
        after: { name: updated.name, role: updated.role, status: updated.status },
      },
    });

    return updated;
  }

  /** Hard-deletes a still-PENDING registration so the email can be reused. */
  async reject(id: string, actorId?: string): Promise<{ message: string }> {
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found');
    if (user.status !== UserStatus.PENDING) {
      throw new AppException(
        'CONFLICT',
        'Only a pending registration can be rejected',
      );
    }
    await this.prisma.user.delete({ where: { id } });

    await this.audit.record({
      actorId,
      action: 'USER_REJECT',
      entity: 'USER',
      entityId: id,
      description: `Từ chối đăng ký tài khoản "${user.name}" (${user.email})`,
      diff: { rejectedEmail: user.email, name: user.name },
    });

    return { message: 'Registration rejected' };
  }

  async remove(
    id: string,
    currentUserId: string,
  ): Promise<{ message: string }> {
    if (id === currentUserId) {
      throw new AppException('CONFLICT', 'You cannot delete your own account');
    }
    const user = await this.prisma.user.findFirst({
      where: { id, deletedAt: null },
    });
    if (!user) throw new AppException('NOT_FOUND', 'User not found');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), status: UserStatus.DISABLED },
    });
    await this.tokens.revokeAllRefreshTokens(id);

    await this.audit.record({
      actorId: currentUserId,
      action: 'USER_DELETE',
      entity: 'USER',
      entityId: id,
      description: `Xóa tài khoản người dùng "${user.name}" (${user.email})`,
      diff: { email: user.email, name: user.name, role: user.role },
    });

    return { message: 'User deleted' };
  }
}
