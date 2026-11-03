import 'reflect-metadata';
import { Role, SessionStatus, UserStatus } from '@prisma/client';
import { TrainingService } from './training.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  TrainingOverviewController,
  HorseSessionsController,
  SessionsController,
} from './training.controller';
import { ROLES_KEY } from '../common/decorators/roles.decorator';
import { MissedSessionsJob } from './missed-sessions.job';
import { ListSessionsQueryDto } from './dto/training.dto';
import { validate } from 'class-validator';

const now = new Date('2026-10-29T02:00:00Z');
const future = '2026-10-30T08:00:00Z';
const trainer = { id: 'trainer', role: Role.TRAINER } as AuthUser;

describe('Hai training rules (mocked database only)', () => {
  const session = {
    id: 'session',
    horseId: 'horse',
    trainerId: 'trainer',
    groomId: null,
    planId: null,
    status: SessionStatus.PLANNED,
    scheduledAt: new Date(future),
    resultMetric: null,
    resultValue: null,
    horse: { ownerId: 'owner', name: 'Willow' },
  };
  let db: ReturnType<typeof makeDb>;
  let service: TrainingService;
  const notifications = {
    groomIds: jest.fn().mockResolvedValue(['groom']),
    notifyUsers: jest.fn(),
  };
  function makeDb() {
    return {
      horse: {
        findFirst: jest
          .fn()
          .mockResolvedValue({ locked: false, ownerId: 'owner' }),
      },
      user: {
        findFirst: jest.fn().mockResolvedValue({ id: 'groom' }),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
      trainingPlan: {
        findUnique: jest.fn().mockResolvedValue({
          horseId: 'horse',
          startDate: new Date('2026-10-30'),
          endDate: new Date('2026-11-02'),
        }),
      },
      trainingSession: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn().mockResolvedValue(session),
        findUniqueOrThrow: jest.fn().mockResolvedValue(session),
        create: jest.fn().mockImplementation((arg: { data: object }) =>
          Promise.resolve({
            ...session,
            ...arg.data,
            groom: { id: 'groom', name: 'Alex' },
          }),
        ),
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(101),
        groupBy: jest.fn().mockResolvedValue([]),
      },
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn((queries: Promise<unknown>[]) =>
        Promise.all(queries),
      ),
    };
  }
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();
    db = makeDb();
    service = new TrainingService(
      db as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    );
  });
  afterEach(() => jest.useRealTimers());

  it('reconciles only overdue PLANNED, strictly before now, idempotently', async () => {
    const rows = [
      { status: SessionStatus.PLANNED, at: new Date(now.getTime() - 1) },
      { status: SessionStatus.PLANNED, at: now },
      { status: SessionStatus.PLANNED, at: new Date(future) },
      ...[
        SessionStatus.DONE,
        SessionStatus.CANCELLED,
        SessionStatus.MISSED,
      ].map((status) => ({ status, at: new Date(0) })),
    ];
    db.trainingSession.updateMany.mockImplementation(
      (args: {
        where: { status: SessionStatus; scheduledAt: { lt: Date } };
        data: { status: SessionStatus };
      }) => {
        let count = 0;
        rows.forEach((r) => {
          if (
            r.status === args.where.status &&
            r.at < args.where.scheduledAt.lt
          ) {
            r.status = args.data.status;
            count++;
          }
        });
        return Promise.resolve({ count });
      },
    );
    expect((await service.reconcileMissed(now)).count).toBe(1);
    expect((await service.reconcileMissed(now)).count).toBe(0);
    expect(rows.map((r) => r.status)).toEqual([
      'MISSED',
      'PLANNED',
      'PLANNED',
      'DONE',
      'CANCELLED',
      'MISSED',
    ]);
    expect(notifications.notifyUsers).not.toHaveBeenCalled();
  });
  it.each(['DONE', 'CANCELLED', 'PLANNED'] as const)(
    'MISSED cannot become %s',
    async (status) => {
      db.trainingSession.findUnique.mockResolvedValue({
        ...session,
        status: SessionStatus.MISSED,
      });
      await expect(
        service.update('session', { status }, trainer),
      ).rejects.toThrow('already MISSED');
    },
  );
  it('does not allow manual MISSED assignment', async () => {
    await expect(
      service.update('session', { status: SessionStatus.MISSED }, trainer),
    ).rejects.toThrow('automatically');
  });
  it('rejects past creation and past rescheduling', async () => {
    await expect(
      service.create(
        'horse',
        { type: 'Canter', scheduledAt: '2026-10-28T00:00:00Z' },
        trainer,
      ),
    ).rejects.toThrow('past');
    await expect(
      service.update(
        'session',
        { scheduledAt: '2026-10-28T00:00:00Z' },
        trainer,
      ),
    ).rejects.toThrow('past');
    expect(db.trainingSession.create).not.toHaveBeenCalled();
  });
  it('frozen now boundary accepts equality and rejects one millisecond earlier', async () => {
    await expect(
      service.create(
        'horse',
        { type: 'Walk', scheduledAt: now.toISOString() },
        trainer,
      ),
    ).resolves.toHaveProperty('id');
    await expect(
      service.create(
        'horse',
        {
          type: 'Walk',
          scheduledAt: new Date(now.getTime() - 1).toISOString(),
        },
        trainer,
      ),
    ).rejects.toThrow('past');
  });
  it.each([
    ['2026-10-29T16:59:59Z', false], // just before start day in Vietnam
    ['2026-10-29T17:00:00Z', true],
    ['2026-10-31T08:00:00Z', true],
    ['2026-11-02T08:00:00Z', true], // 15:00 on end day
    ['2026-11-02T16:59:59Z', true],
    ['2026-11-02T17:00:00Z', false],
  ])(
    'plan calendar containment %s accepted=%s',
    async (scheduledAt, accepted) => {
      const request = service.create(
        'horse',
        { type: 'Canter', scheduledAt: String(scheduledAt), planId: 'plan' },
        trainer,
      );
      if (accepted) await expect(request).resolves.toHaveProperty('id');
      else await expect(request).rejects.toThrow('training plan dates');
    },
  );
  it('accepts open-ended plan and nullable groom', async () => {
    db.trainingPlan.findUnique.mockResolvedValue({
      horseId: 'horse',
      startDate: now,
      endDate: null,
    });
    await expect(
      service.create(
        'horse',
        { type: 'Canter', scheduledAt: future, planId: 'plan', groomId: null },
        trainer,
      ),
    ).resolves.toHaveProperty('groomId', null);
  });
  it('checks plan on reschedule and plan-only change', async () => {
    db.trainingSession.findUnique.mockResolvedValue({
      ...session,
      planId: 'plan',
    });
    await expect(
      service.update(
        'session',
        { scheduledAt: '2026-11-04T10:00:00Z' },
        trainer,
      ),
    ).rejects.toThrow('training plan dates');
    db.trainingPlan.findUnique.mockResolvedValue({
      horseId: 'other',
      startDate: now,
      endDate: null,
    });
    await expect(
      service.update('session', { planId: 'other-plan' }, trainer),
    ).rejects.toThrow('this horse');
    await expect(
      service.create(
        'horse',
        { scheduledAt: future, type: 'Canter', planId: 'other-plan' },
        trainer,
      ),
    ).rejects.toThrow('this horse');
  });
  it.each([
    Role.TRAINER,
    Role.VET,
    Role.OWNER,
    Role.MANAGER,
    'disabled',
    'deleted',
    'missing',
  ])('rejects invalid groom %s', async (kind) => {
    const candidate = {
      id: 'invalid',
      role: kind === 'disabled' || kind === 'deleted' ? Role.GROOM : kind,
      status: kind === 'disabled' ? UserStatus.DISABLED : UserStatus.ACTIVE,
      deletedAt: kind === 'deleted' ? now : null,
    };
    db.user.findFirst.mockImplementation(
      (args: {
        where: { id: string; role: Role; status: UserStatus; deletedAt: null };
      }) =>
        Promise.resolve(
          kind !== 'missing' &&
            Object.entries(args.where).every(
              ([key, value]) => candidate[key] === value,
            )
            ? { id: candidate.id }
            : null,
        ),
    );
    await expect(
      service.create(
        'horse',
        { scheduledAt: future, type: 'Canter', groomId: 'invalid' },
        trainer,
      ),
    ).rejects.toThrow('active GROOM');
    expect(db.user.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'invalid',
        role: Role.GROOM,
        status: UserStatus.ACTIVE,
        deletedAt: null,
      },
      select: { id: true },
    });
  });
  it('returns groom and retains trainer responsibility', async () => {
    const result = await service.create(
      'horse',
      { scheduledAt: future, type: 'Canter', groomId: 'groom' },
      trainer,
    );
    expect(result.groom).toEqual({ id: 'groom', name: 'Alex' });
    expect(result.trainerId).toBe('trainer');
    expect(db.trainingSession.create.mock.calls[0][0]).toMatchObject({
      include: { groom: { select: { id: true, name: true } } },
    });
  });
  it.each([{ groomId: 'groom' }, { planId: 'plan' }, { scheduledAt: future }])(
    'GROOM cannot schedule or assign %p',
    async (dto) => {
      await expect(
        service.update('session', dto, { ...trainer, role: Role.GROOM }),
      ).rejects.toThrow('only change status');
    },
  );
  it('keeps EX-01 on create and reschedule; excludes edited session', async () => {
    db.trainingSession.findFirst.mockResolvedValue({
      type: 'Canter',
      scheduledAt: new Date(future),
    });
    await expect(
      service.create('horse', { type: 'Canter', scheduledAt: future }, trainer),
    ).rejects.toThrow();
    await expect(
      service.update('session', { scheduledAt: future }, trainer),
    ).rejects.toThrow();
    expect(db.trainingSession.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { not: 'session' },
          horseId: 'horse',
          status: 'PLANNED',
          scheduledAt: {
            gte: new Date('2026-10-30T07:00:00Z'),
            lte: new Date('2026-10-30T09:00:00Z'),
          },
        }),
      }),
    );
  });
  it('preserves lock priority', async () => {
    db.horse.findFirst.mockResolvedValue({ locked: true, ownerId: 'owner' });
    await expect(
      service.create('horse', { type: 'Canter', scheduledAt: future }, trainer),
    ).rejects.toThrow('locked');
    expect(db.trainingSession.create).not.toHaveBeenCalled();
  });
  it('conditional write cannot reopen concurrently terminal sessions', async () => {
    db.trainingSession.updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 0 });
    await expect(
      service.update('session', { notes: 'Changed' }, trainer),
    ).rejects.toThrow('Only a planned');
  });
  it.each([195, 196])(
    'fitness threshold remains strictly >195: %s',
    async (value) => {
      db.trainingSession.findUniqueOrThrow.mockResolvedValue({
        ...session,
        status: SessionStatus.DONE,
        resultMetric: 'heart_rate_max',
        resultValue: value,
      });
      await service.update(
        'session',
        {
          status: SessionStatus.DONE,
          resultMetric: 'heart_rate_max',
          resultValue: value,
        },
        { ...trainer, role: Role.GROOM },
      );
      expect(notifications.notifyUsers).toHaveBeenCalledTimes(
        value > 195 ? 1 : 0,
      );
    },
  );
  it.each([1, 6, 99])(
    'session pagination page %s and MISSED filter',
    async (page) => {
      const result = await service.listByHorse('horse', {
        page,
        limit: 20,
        status: SessionStatus.MISSED,
      });
      expect(result.meta).toEqual({ page, limit: 20, total: 101 });
      expect(db.trainingSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { horseId: 'horse', status: 'MISSED' },
          skip: (page - 1) * 20,
          take: 20,
        }),
      );
      expect(result.data).toEqual([]);
    },
  );
  it('DTO accepts MISSED filter', async () => {
    const dto = new ListSessionsQueryDto();
    dto.status = SessionStatus.MISSED;
    expect(await validate(dto)).toEqual([]);
  });
  it.each([Role.OWNER, Role.VET, Role.GROOM])(
    'overview denies %s before any query',
    async (role) => {
      await expect(service.overview({ ...trainer, role })).rejects.toThrow(
        'Insufficient role',
      );
      expect(db.$transaction).not.toHaveBeenCalled();
      expect(db.trainingSession.updateMany).not.toHaveBeenCalled();
    },
  );
  it('overview aggregates counts, club weeks, MISSED, preserves denominator', async () => {
    db.trainingSession.groupBy.mockResolvedValue([
      { status: 'DONE', _count: { _all: 12 } },
      { status: 'CANCELLED', _count: { _all: 2 } },
      { status: 'MISSED', _count: { _all: 9 } },
    ]);
    db.$queryRaw.mockResolvedValue([
      { week: new Date('2026-10-26'), status: 'MISSED', count: 9n },
    ]);
    const result = await service.overview(trainer, now);
    expect(result.total).toBe(23);
    expect(result.completion).toBe(86);
    expect(result.weeks).toHaveLength(8);
    expect(result.weeks[7]).toMatchObject({ week: '2026-10-26', MISSED: 9 });
    expect(db.trainingSession.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { horse: { deletedAt: null } } }),
    );
  });
  it('empty overview returns zeros and null completion', async () => {
    const result = await service.overview(
      { ...trainer, role: Role.MANAGER },
      now,
    );
    expect(result.total).toBe(0);
    expect(result.completion).toBeNull();
    expect(result.weeks).toHaveLength(8);
  });
  // Controller methods are inspected for decorator metadata, never invoked unbound.
  /* eslint-disable @typescript-eslint/unbound-method */
  it('controller role contracts remain explicit', () => {
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TrainingOverviewController.prototype.overview,
      ),
    ).toEqual([Role.MANAGER, Role.TRAINER]);
    expect(
      Reflect.getMetadata(
        ROLES_KEY,
        TrainingOverviewController.prototype.grooms,
      ),
    ).toEqual([Role.TRAINER]);
    expect(
      Reflect.getMetadata(ROLES_KEY, HorseSessionsController.prototype.create),
    ).toEqual([Role.TRAINER]);
    expect(
      Reflect.getMetadata(ROLES_KEY, SessionsController.prototype.update),
    ).toEqual([Role.TRAINER, Role.GROOM]);
  });
  /* eslint-enable @typescript-eslint/unbound-method */
  it('scheduler runs at boot and every minute, stops on destroy', async () => {
    const job = new MissedSessionsJob(service);
    job.onApplicationBootstrap();
    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(120_000);
    expect(db.trainingSession.updateMany).toHaveBeenCalledTimes(3);
    job.onModuleDestroy();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(db.trainingSession.updateMany).toHaveBeenCalledTimes(3);
  });
  it('scheduler prevents overlapping ticks and permits the next completed run', async () => {
    let release!: (value: { count: number }) => void;
    db.trainingSession.updateMany.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const job = new MissedSessionsJob(service);
    const first = job.tick();
    await job.tick();
    expect(db.trainingSession.updateMany).toHaveBeenCalledTimes(1);
    release({ count: 0 });
    await first;
    await job.tick();
    expect(db.trainingSession.updateMany).toHaveBeenCalledTimes(2);
  });
});
