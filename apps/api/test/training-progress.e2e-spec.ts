import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { SessionStatus } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * UC-13 — GET /training-progress (overall training progress). Sessions are
 * inserted directly through Prisma so the fixture can contain past/overdue
 * rows without tripping the create-time scheduling rules.
 */
describe('Training progress (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let horseId: string;

  const DAY = 86_400_000;
  const api = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  const login = async (email: string, password: string): Promise<string> => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  };

  type Row = {
    horse: { id: string };
    plans: { total: number; active: number };
    sessions: Record<string, number>;
    completionRate: number | null;
    lastSession: { type: string; resultValue: number | null } | null;
    nextSession: { type: string } | null;
  };
  const rowOf = (body: { horses: Row[] }) =>
    body.horses.find((r) => r.horse.id === horseId);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.useGlobalFilters(new AllExceptionsFilter());
    await app.init();
    prisma = app.get(PrismaService);

    tokens.manager = await login('manager@racehorse.local', 'Manager123!');
    tokens.trainer = await login('trainer@racehorse.local', 'Trainer123!');
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');
    tokens.owner2 = await login('owner2@racehorse.local', 'Owner123!');

    const owner1 = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner1@racehorse.local' },
    });
    const trainer = await prisma.user.findUniqueOrThrow({
      where: { email: 'trainer@racehorse.local' },
    });

    const horse = await prisma.horse.create({
      data: { name: 'E2E Progress', ownerId: owner1.id },
    });
    horseId = horse.id;

    const now = Date.now();
    await prisma.trainingPlan.create({
      data: {
        horseId,
        trainerId: trainer.id,
        goal: 'Base fitness',
        startDate: new Date(now - 10 * DAY),
        endDate: new Date(now + 10 * DAY),
      },
    });
    const session = (
      offsetDays: number,
      status: SessionStatus,
      type: string,
    ) => ({
      horseId,
      trainerId: trainer.id,
      scheduledAt: new Date(now + offsetDays * DAY),
      type,
      status,
      ...(status === SessionStatus.DONE
        ? { resultMetric: 'heart_rate_max', resultValue: 180 }
        : {}),
    });
    await prisma.trainingSession.createMany({
      data: [
        session(-5, SessionStatus.DONE, 'gallop'),
        session(-3, SessionStatus.CANCELLED, 'swim'),
        session(-1, SessionStatus.PLANNED, 'trot'), // overdue
        session(2, SessionStatus.PLANNED, 'sprint'),
      ],
    });
  });

  afterAll(async () => {
    await prisma.trainingSession.deleteMany({ where: { horseId } });
    await prisma.trainingPlan.deleteMany({ where: { horseId } });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    await app.close();
  });

  it('requires authentication (401)', async () => {
    const res = await api().get('/api/v1/training-progress');
    expect(res.status).toBe(401);
  });

  it('aggregates sessions, plans and last/next session per horse', async () => {
    const res = await api()
      .get('/api/v1/training-progress')
      .set(auth('trainer'));
    expect(res.status).toBe(200);
    const row = rowOf(res.body);
    expect(row).toBeDefined();
    expect(row!.plans).toEqual({ total: 1, active: 1 });
    expect(row!.sessions).toEqual({
      total: 4,
      done: 1,
      planned: 2,
      cancelled: 1,
      overdue: 1,
    });
    // 1 done out of 3 non-cancelled sessions
    expect(row!.completionRate).toBe(33);
    expect(row!.lastSession).toMatchObject({
      type: 'gallop',
      resultValue: 180,
    });
    expect(row!.nextSession).toMatchObject({ type: 'sprint' });

    expect(res.body.summary.horses).toBeGreaterThanOrEqual(1);
    expect(res.body.summary.sessions.total).toBeGreaterThanOrEqual(4);
  });

  it('from/to narrows the session window', async () => {
    const res = await api()
      .get('/api/v1/training-progress')
      .query({ from: new Date(Date.now() - 2 * DAY).toISOString() })
      .set(auth('manager'));
    expect(res.status).toBe(200);
    const row = rowOf(res.body);
    expect(row!.sessions).toMatchObject({ total: 2, done: 0, overdue: 1 });
    expect(row!.lastSession).toBeNull();
  });

  it('rejects an invalid date (400)', async () => {
    const res = await api()
      .get('/api/v1/training-progress')
      .query({ from: 'yesterday' })
      .set(auth('manager'));
    expect(res.status).toBe(400);
  });

  it('OWNER only sees their own horses', async () => {
    const mine = await api()
      .get('/api/v1/training-progress')
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(rowOf(mine.body)).toBeDefined();

    const notMine = await api()
      .get('/api/v1/training-progress')
      .set(auth('owner2'));
    expect(notMine.status).toBe(200);
    expect(rowOf(notMine.body)).toBeUndefined();
  });
});
