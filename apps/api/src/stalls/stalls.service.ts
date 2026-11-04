import { Injectable, Logger } from '@nestjs/common';
import {
  NotificationType,
  Role,
  Stall,
  StallStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  ApproveStallStatusDto,
  CreateStallDto,
  RequestStallStatusDto,
  UpdateStallDto,
} from './dto/stalls.dto';

const STALL_STATUS_LABELS: Record<StallStatus, string> = {
  AVAILABLE: 'Sẵn sàng / Trống',
  OCCUPIED: 'Đang có ngựa',
  CLEANING: 'Đang vệ sinh',
  MAINTENANCE: 'Đang bảo trì',
  OUT_OF_SERVICE: 'Ngừng hoạt động',
  DISINFECTING: 'Đang khử trùng',
  QUARANTINED: 'Đang cách ly dịch bệnh',
};

@Injectable()
export class StallsService {
  private readonly logger = new Logger('StallsService');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Lấy danh sách chuồng trại kèm thông tin ngựa ở ô chuồng đó.
   * Nếu user là OWNER: Chỉ xem được chi tiết ngựa của chính mình.
   * Ngựa của chủ khác sẽ được che thông tin (an toàn & bảo mật).
   */
  async listStalls(currentUser: AuthUser) {
    const isOwner = currentUser.role === Role.OWNER;

    const [stalls, horses] = await Promise.all([
      this.prisma.stall.findMany({
        orderBy: [{ barn: 'asc' }, { code: 'asc' }],
      }),
      this.prisma.horse.findMany({
        where: { deletedAt: null, stallNumber: { not: null } },
        select: {
          id: true,
          name: true,
          stallNumber: true,
          saddleNumber: true,
          photoPath: true,
          status: true,
          healthStatus: true,
          locked: true,
          lockReason: true,
          fitnessScore: true,
          breed: true,
          ownerId: true,
          owner: { select: { id: true, name: true, email: true } },
          trainer: { select: { id: true, name: true, email: true } },
          groom: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    // Map stallNumber -> Horse
    const horseByStall = new Map<string, (typeof horses)[0]>();
    for (const h of horses) {
      if (h.stallNumber) {
        horseByStall.set(h.stallNumber.trim().toUpperCase(), h);
      }
    }

    return stalls.map((stall) => {
      const h = horseByStall.get(stall.code.trim().toUpperCase());
      let horseData: any = null;

      if (h) {
        if (isOwner && h.ownerId !== currentUser.id) {
          // Che giấu chi tiết ngựa của chủ khác
          horseData = {
            id: h.id,
            name: 'Ngựa khác (Bảo mật)',
            isOtherOwner: true,
            status: h.status,
            healthStatus: h.healthStatus,
            locked: h.locked,
          };
        } else {
          horseData = {
            ...h,
            isOtherOwner: false,
            photoUrl: h.photoPath ? `/api/v1/horses/${h.id}/photo` : null,
          };
        }
      }

      return {
        ...stall,
        horse: horseData,
      };
    });
  }

  /**
   * Gợi ý mã chuồng tiếp theo trong dãy (ví dụ A-10 -> gợi ý A-11)
   */
  async getNextCode(barn: string): Promise<string> {
    const cleanBarn = (barn || 'A').trim().toUpperCase();
    const stalls = await this.prisma.stall.findMany({
      where: { barn: cleanBarn },
      select: { code: true },
    });

    let maxNum = 0;
    const regex = new RegExp(`^${cleanBarn}-(\\d+)$`, 'i');
    for (const s of stalls) {
      const match = s.code.match(regex);
      if (match) {
        const n = parseInt(match[1], 10);
        if (!isNaN(n) && n > maxNum) maxNum = n;
      }
    }

    const nextNum = maxNum + 1;
    return `${cleanBarn}-${String(nextNum).padStart(2, '0')}`;
  }

  /**
   * Tạo ô chuồng mới
   */
  async createStall(dto: CreateStallDto): Promise<Stall> {
    const code = dto.code.trim().toUpperCase();
    const barn = (dto.barn || code.charAt(0) || 'A').trim().toUpperCase();

    const existing = await this.prisma.stall.findUnique({ where: { code } });
    if (existing) {
      throw new AppException('CONFLICT', `Ô chuồng mã ${code} đã tồn tại trong hệ thống.`);
    }

    return this.prisma.stall.create({
      data: {
        code,
        barn,
        status: dto.status ?? StallStatus.AVAILABLE,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  /**
   * Sửa ô chuồng
   */
  async updateStall(id: string, dto: UpdateStallDto): Promise<Stall> {
    const stall = await this.prisma.stall.findUnique({ where: { id } });
    if (!stall) throw new AppException('NOT_FOUND', 'Ô chuồng không tồn tại.');

    const newCode = dto.code ? dto.code.trim().toUpperCase() : stall.code;
    if (newCode !== stall.code) {
      const dupe = await this.prisma.stall.findUnique({ where: { code: newCode } });
      if (dupe) {
        throw new AppException('CONFLICT', `Mã chuồng ${newCode} đã được sử dụng.`);
      }

      // Cập nhật mã chuồng ở ngựa đang ở ô này (nếu có)
      await this.prisma.horse.updateMany({
        where: { stallNumber: stall.code },
        data: { stallNumber: newCode },
      });
    }

    return this.prisma.stall.update({
      where: { id },
      data: {
        code: newCode,
        barn: dto.barn ? dto.barn.trim().toUpperCase() : stall.barn,
        status: dto.status ?? stall.status,
        notes: dto.notes !== undefined ? dto.notes?.trim() || null : stall.notes,
      },
    });
  }

  /**
   * Xóa ô chuồng: CẤM XÓA nếu đang có ngựa
   */
  async deleteStall(id: string): Promise<void> {
    const stall = await this.prisma.stall.findUnique({ where: { id } });
    if (!stall) throw new AppException('NOT_FOUND', 'Ô chuồng không tồn tại.');

    // Kiểm tra có ngựa trong chuồng không
    const horse = await this.prisma.horse.findFirst({
      where: {
        stallNumber: { equals: stall.code, mode: 'insensitive' },
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (horse) {
      throw new AppException(
        'VALIDATION_ERROR',
        `Không thể xóa ô chuồng ${stall.code} vì chiến mã "${horse.name}" đang được xếp ở đây. Hãy dọn chuồng hoặc chuyển ngựa sang chuồng khác trước.`,
      );
    }

    await this.prisma.stall.delete({ where: { id } });
  }

  /**
   * Yêu cầu chuyển trạng thái chuồng.
   * Đối với DISINFECTING (Khử trùng) hoặc QUARANTINED (Cách ly):
   * Phải đưa vào pendingStatus và gửi thông báo chờ VET hoặc GROOM xác nhận phê duyệt.
   */
  async requestStatus(id: string, dto: RequestStallStatusDto, requester: AuthUser): Promise<Stall> {
    const stall = await this.prisma.stall.findUnique({ where: { id } });
    if (!stall) throw new AppException('NOT_FOUND', 'Ô chuồng không tồn tại.');

    const target = dto.targetStatus;
    const isSensitive = target === StallStatus.DISINFECTING || target === StallStatus.QUARANTINED;

    if (isSensitive) {
      // Đưa vào trạng thái chờ duyệt
      const updated = await this.prisma.stall.update({
        where: { id },
        data: {
          pendingStatus: target,
          pendingNotes: dto.notes?.trim() || null,
          pendingRequestedById: requester.id,
          pendingRequestedAt: new Date(),
        },
      });

      // Bắn notification tới toàn bộ VET và GROOM
      const [vets, grooms] = await Promise.all([
        this.prisma.user.findMany({ where: { role: Role.VET, deletedAt: null }, select: { id: true } }),
        this.prisma.user.findMany({ where: { role: Role.GROOM, deletedAt: null }, select: { id: true } }),
      ]);
      const recipients = [...vets.map((u) => u.id), ...grooms.map((u) => u.id)];

      if (recipients.length > 0) {
        const actionLabel = target === StallStatus.QUARANTINED ? 'CÁCH LY' : 'KHỬ TRÙNG';
        await this.notifications.notifyUsers(
          recipients,
          NotificationType.STALL_STATUS_REQUESTED,
          `Yêu cầu chuyển ô chuồng ${stall.code} sang trạng thái ${actionLabel}. Cần Bác sĩ thú y hoặc Groom kiểm tra và xác nhận.`,
        );
      }

      return updated;
    }

    // Các trạng thái thông thường (AVAILABLE, CLEANING, MAINTENANCE, OUT_OF_SERVICE) chuyển ngay
    return this.prisma.stall.update({
      where: { id },
      data: {
        status: target,
        pendingStatus: null,
        pendingNotes: null,
        pendingRequestedById: null,
        pendingRequestedAt: null,
      },
    });
  }

  /**
   * VET hoặc GROOM phê duyệt hoặc từ chối chuyển trạng thái chuồng
   */
  async approveStatus(id: string, dto: ApproveStallStatusDto, approver: AuthUser): Promise<Stall> {
    const stall = await this.prisma.stall.findUnique({ where: { id } });
    if (!stall) throw new AppException('NOT_FOUND', 'Ô chuồng không tồn tại.');

    if (!stall.pendingStatus) {
      throw new AppException('VALIDATION_ERROR', 'Ô chuồng này hiện không có yêu cầu chuyển trạng thái nào đang chờ duyệt.');
    }

    if (dto.approved) {
      const newStatus = stall.pendingStatus;
      const updated = await this.prisma.stall.update({
        where: { id },
        data: {
          status: newStatus,
          pendingStatus: null,
          pendingNotes: null,
          pendingRequestedById: null,
          pendingRequestedAt: null,
          notes: dto.notes
            ? `${stall.notes ? stall.notes + ' | ' : ''}Được duyệt bởi ${approver.name}: ${dto.notes.trim()}`
            : stall.notes,
        },
      });

      // Thông báo cho Managers
      const managers = await this.prisma.user.findMany({
        where: { role: Role.MANAGER, deletedAt: null },
        select: { id: true },
      });
      if (managers.length > 0) {
        await this.notifications.notifyUsers(
          managers.map((m) => m.id),
          NotificationType.STALL_STATUS_APPROVED,
          `Ô chuồng ${stall.code} đã được ${approver.name} (${approver.role}) phê duyệt chuyển sang trạng thái: ${STALL_STATUS_LABELS[newStatus]}.`,
        );
      }

      return updated;
    } else {
      // Từ chối phê duyệt, hủy pending
      return this.prisma.stall.update({
        where: { id },
        data: {
          pendingStatus: null,
          pendingNotes: null,
          pendingRequestedById: null,
          pendingRequestedAt: null,
        },
      });
    }
  }

  /**
   * Xếp hoặc dọn chuồng cho ngựa.
   * Validation nghiêm ngặt:
   * 1. Không cho 2 ngựa xếp vào cùng 1 chuồng (Double-booking check).
   * 2. Không cho xếp ngựa vào chuồng đang KHỬ TRÙNG (DISINFECTING) hoặc CÁCH LY (QUARANTINED) hoặc NGỪNG HOẠT ĐỘNG.
   */
  async assignHorseToStall(horseId: string, stallCode: string | null) {
    const horse = await this.prisma.horse.findUnique({
      where: { id: horseId },
      select: { id: true, name: true, stallNumber: true },
    });
    if (!horse) throw new AppException('NOT_FOUND', 'Không tìm thấy thông tin ngựa.');

    // Nếu dọn chuồng (stallCode = null)
    if (!stallCode || !stallCode.trim()) {
      const oldCode = horse.stallNumber;
      await this.prisma.horse.update({
        where: { id: horseId },
        data: { stallNumber: null },
      });

      if (oldCode) {
        // Cập nhật lại chuồng cũ thành AVAILABLE nếu không còn ngựa nào khác
        const otherHorse = await this.prisma.horse.findFirst({
          where: { stallNumber: oldCode, id: { not: horseId }, deletedAt: null },
        });
        if (!otherHorse) {
          await this.prisma.stall.updateMany({
            where: { code: oldCode, status: StallStatus.OCCUPIED },
            data: { status: StallStatus.AVAILABLE },
          });
        }
      }
      return { success: true, message: `Đã dọn chuồng cho chiến mã ${horse.name}.` };
    }

    const code = stallCode.trim().toUpperCase();

    // 1. Kiểm tra trạng thái an toàn của ô chuồng
    const stall = await this.prisma.stall.findUnique({ where: { code } });
    if (stall) {
      if (stall.status === StallStatus.QUARANTINED) {
        throw new AppException(
          'VALIDATION_ERROR',
          `Ô chuồng ${code} đang trong diện CÁCH LY DỊCH BỆNH. Tuyệt đối không được xếp ngựa vào ô này!`,
        );
      }
      if (stall.status === StallStatus.DISINFECTING) {
        throw new AppException(
          'VALIDATION_ERROR',
          `Ô chuồng ${code} đang tiến hành KHỬ TRÙNG hóa chất. Vui lòng đợi hoàn tất trước khi xếp ngựa.`,
        );
      }
      if (stall.status === StallStatus.OUT_OF_SERVICE) {
        throw new AppException(
          'VALIDATION_ERROR',
          `Ô chuồng ${code} hiện đang NGỪNG HOẠT ĐỘNG do xuống cấp hoặc kế hoạch tu sửa.`,
        );
      }
    }

    // 2. Double-booking check: Kiểm tra ô chuồng đã có ngựa khác chưa
    const existingOccupant = await this.prisma.horse.findFirst({
      where: {
        stallNumber: code,
        id: { not: horseId },
        deletedAt: null,
      },
      select: { id: true, name: true },
    });

    if (existingOccupant) {
      throw new AppException(
        'CONFLICT',
        `Ô chuồng ${code} đã có chiến mã "${existingOccupant.name}" đang ở. Mỗi ô chuồng chỉ chứa tối đa 1 ngựa! Vui lòng chọn chuồng trống hoặc dọn chuồng trước.`,
      );
    }

    // Tiến hành gán chuồng
    const oldCode = horse.stallNumber;
    await this.prisma.horse.update({
      where: { id: horseId },
      data: { stallNumber: code },
    });

    // Cập nhật trạng thái chuồng mới thành OCCUPIED
    await this.prisma.stall.upsert({
      where: { code },
      update: { status: StallStatus.OCCUPIED },
      create: {
        code,
        barn: code.charAt(0) || 'A',
        status: StallStatus.OCCUPIED,
      },
    });

    // Cập nhật lại chuồng cũ thành AVAILABLE (nếu có)
    if (oldCode && oldCode.toUpperCase() !== code) {
      const other = await this.prisma.horse.findFirst({
        where: { stallNumber: oldCode, deletedAt: null },
      });
      if (!other) {
        await this.prisma.stall.updateMany({
          where: { code: oldCode, status: StallStatus.OCCUPIED },
          data: { status: StallStatus.AVAILABLE },
        });
      }
    }

    return { success: true, message: `Đã xếp chiến mã ${horse.name} vào ô chuồng ${code}.` };
  }
}
