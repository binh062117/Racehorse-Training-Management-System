import { Injectable } from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  Role,
  SupplyRequestStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AppException } from '../common/app-exception';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateSupplyItemDto,
  CreateSupplyRequestDto,
  ListSupplyItemsQueryDto,
  ListSupplyRequestsQueryDto,
  ReviewSupplyRequestDto,
  UpdateSupplyItemDto,
} from './dto/supplies.dto';

const PERSON = { select: { id: true, name: true } } as const;
const REQUEST_INCLUDE = {
  item: {
    select: {
      id: true,
      name: true,
      unit: true,
      category: true,
      quantity: true,
    },
  },
  requestedBy: PERSON,
  reviewedBy: PERSON,
} satisfies Prisma.SupplyRequestInclude;

/**
 * Stable supplies (feed, medicine, equipment).
 * - Groom sees stock and asks for more; Manager approves or rejects.
 * - An approved request is treated as bought: its quantity is added to stock.
 * - Feeding records that name a FEED item take their quantity out of stock
 *   (see FeedingService), so the feed count follows real use.
 */
@Injectable()
export class SuppliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async listItems(q: ListSupplyItemsQueryDto) {
    const text = q.q?.trim();
    const items = await this.prisma.supplyItem.findMany({
      where: {
        deletedAt: null,
        ...(q.category ? { category: q.category } : {}),
        ...(text ? { name: { contains: text, mode: 'insensitive' } } : {}),
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
      include: {
        requests: {
          where: { status: SupplyRequestStatus.PENDING },
          select: { id: true, quantity: true },
        },
      },
    });
    const view = items.map(({ requests, ...item }) => ({
      ...item,
      low: item.quantity <= item.minQuantity,
      pendingRequests: requests.length,
      pendingQuantity: requests.reduce((s, r) => s + r.quantity, 0),
    }));
    return q.low === 'true' ? view.filter((i) => i.low) : view;
  }

  async createItem(dto: CreateSupplyItemDto) {
    return this.prisma.supplyItem.create({
      data: {
        name: dto.name.trim(),
        category: dto.category,
        unit: dto.unit.trim(),
        quantity: dto.quantity ?? 0,
        minQuantity: dto.minQuantity ?? 0,
        notes: dto.notes?.trim() || null,
      },
    });
  }

  async updateItem(id: string, dto: UpdateSupplyItemDto) {
    await this.findItem(id);
    return this.prisma.supplyItem.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
        ...(dto.unit !== undefined ? { unit: dto.unit.trim() } : {}),
        ...(dto.quantity !== undefined ? { quantity: dto.quantity } : {}),
        ...(dto.minQuantity !== undefined
          ? { minQuantity: dto.minQuantity }
          : {}),
        ...(dto.notes !== undefined ? { notes: dto.notes.trim() || null } : {}),
      },
    });
  }

  async removeItem(id: string) {
    await this.findItem(id);
    await this.prisma.supplyItem.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Supply item deleted' };
  }

  async listRequests(q: ListSupplyRequestsQueryDto, user: AuthUser) {
    const where: Prisma.SupplyRequestWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      // A groom follows their own requests; the manager sees everyone's.
      ...(user.role === Role.GROOM ? { requestedById: user.id } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.supplyRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        // Waiting requests first, then newest.
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
      this.prisma.supplyRequest.count({ where }),
    ]);
    return { data, meta: { page: q.page, limit: q.limit, total } };
  }

  async createRequest(dto: CreateSupplyRequestDto, user: AuthUser) {
    const item = await this.findItem(dto.itemId);
    const request = await this.prisma.supplyRequest.create({
      data: {
        itemId: item.id,
        quantity: dto.quantity,
        note: dto.note?.trim() || null,
        requestedById: user.id,
      },
      include: REQUEST_INCLUDE,
    });
    await this.notifications.notifyUsers(
      await this.notifications.managerIds(),
      NotificationType.SUPPLY_REQUESTED,
      `${user.name} đề nghị mua thêm ${dto.quantity} ${item.unit} ${item.name} (còn ${item.quantity} ${item.unit})`,
    );
    return request;
  }

  async reviewRequest(
    id: string,
    dto: ReviewSupplyRequestDto,
    manager: AuthUser,
  ) {
    const request = await this.prisma.supplyRequest.findUnique({
      where: { id },
      include: { item: true },
    });
    if (!request)
      throw new AppException('NOT_FOUND', 'Supply request not found');
    if (request.status !== SupplyRequestStatus.PENDING) {
      throw new AppException('VALIDATION_ERROR', 'Yêu cầu này đã được xử lý.');
    }
    const approved = dto.status === SupplyRequestStatus.APPROVED;
    const [updated] = await this.prisma.$transaction([
      this.prisma.supplyRequest.update({
        where: { id },
        data: {
          status: dto.status,
          reviewNote: dto.note?.trim() || null,
          reviewedById: manager.id,
          reviewedAt: new Date(),
        },
        include: REQUEST_INCLUDE,
      }),
      ...(approved
        ? [
            this.prisma.supplyItem.update({
              where: { id: request.itemId },
              data: { quantity: { increment: request.quantity } },
            }),
          ]
        : []),
    ]);
    await this.notifications.notifyUsers(
      [request.requestedById],
      NotificationType.SUPPLY_REVIEWED,
      approved
        ? `Yêu cầu mua ${request.quantity} ${request.item.unit} ${request.item.name} đã được duyệt — đã cộng vào kho`
        : `Yêu cầu mua ${request.quantity} ${request.item.unit} ${request.item.name} bị từ chối${dto.note?.trim() ? `: ${dto.note.trim()}` : ''}`,
    );
    return updated;
  }

  private async findItem(id: string) {
    const item = await this.prisma.supplyItem.findFirst({
      where: { id, deletedAt: null },
    });
    if (!item) throw new AppException('NOT_FOUND', 'Supply item not found');
    return item;
  }
}
