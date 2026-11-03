import { ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import { HealthRecordsService } from './health-records.service';
import { PrismaService } from '../prisma/prisma.service';
import { FileStorageService } from '../files/file-storage.service';
import { CloudinaryService } from '../files/cloudinary.service';
import { HorsesService } from '../horses/horses.service';
import { HorseOwnershipGuard } from '../common/guards/horse-ownership.guard';
import { AuthUser } from '../common/decorators/current-user.decorator';

describe('Health pagination and ownership (no database)', () => {
  const user = { id: 'owner', role: Role.OWNER } as AuthUser;
  function setup() {
    const db = {
      healthRecord: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(105),
      },
      horse: {
        findFirst: jest.fn().mockResolvedValue({ ownerId: 'owner' }),
        groupBy: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    };
    const service = new HealthRecordsService(
      db as unknown as PrismaService,
      {} as FileStorageService,
      {} as CloudinaryService,
      {} as HorsesService,
    );
    return { db, service };
  }
  it.each([1, 6, 99])(
    'global page %s retains total, offsets, filters and OWNER scope',
    async (page) => {
      const { db, service } = setup();
      const result = await service.listAll(
        { page, limit: 20, healthStatus: 'MONITORING', q: 'Willow' },
        user,
      );
      expect(result).toEqual({
        data: [],
        meta: { page, limit: 20, total: 105 },
      });
      expect(db.healthRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: (page - 1) * 20,
          take: 20,
          where: {
            horse: {
              deletedAt: null,
              ownerId: 'owner',
              healthStatus: 'MONITORING',
              name: { contains: 'Willow', mode: 'insensitive' },
            },
          },
        }),
      );
    },
  );
  it.each([1, 6, 99])(
    'horse health page %s uses server pagination',
    async (page) => {
      const { db, service } = setup();
      const result = await service.listByHorse('horse', { page, limit: 20 });
      expect(result.meta.total).toBe(105);
      expect(db.healthRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: (page - 1) * 20,
          take: 20,
          where: { horseId: 'horse' },
        }),
      );
    },
  );
  it('global health summaries remain owner scoped', async () => {
    const { db, service } = setup();
    await service.horseSummary(user);
    expect(db.horse.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'owner', deletedAt: null } }),
    );
    expect(db.horse.count).toHaveBeenCalledWith({
      where: { ownerId: 'owner', deletedAt: null, locked: true },
    });
  });
  it('staff list does not acquire an arbitrary owner filter', async () => {
    const { db, service } = setup();
    await service.listAll({ page: 1, limit: 20 }, { ...user, role: Role.VET });
    expect(db.healthRecord.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { horse: { deletedAt: null } } }),
    );
  });
  it('horse guard permits owned horses, rejects another owner on session and health routes', async () => {
    const { db } = setup();
    const guard = new HorseOwnershipGuard(db as unknown as PrismaService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({ params: { id: 'horse' }, user }),
      }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    db.horse.findFirst.mockResolvedValue({ ownerId: 'another-owner' });
    await expect(guard.canActivate(context)).rejects.toThrow('another owner');
  });
});
