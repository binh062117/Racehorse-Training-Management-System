import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { DailyCareTask, NotificationType } from '@prisma/client';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import {
  careDay,
  formatCareDay,
  nextCareDay,
} from './../src/daily-care/care-day';

/**
 * Daily care checklist: only a groom ticks; a checklist lives for one
 * Vietnam day — the next day it is closed (managers told what was left
 * undone, rows deleted) and a groom generates a fresh one.
 */
describe('Daily care (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const api = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });
  const today = careDay();
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const login = async (email: string, password: string): Promise<string> => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  };

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
    tokens.vet = await login('vet@racehorse.local', 'Vet123!');
    tokens.groom = await login('groom@racehorse.local', 'Groom123!');
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');
  });

  afterAll(async () => {
    await app.close();
  });

  it('groom generates today; a second click adds nothing', async () => {
    const first = await api()
      .post('/api/v1/daily-care/generate')
      .set(auth('groom'))
      .send({ date: ymd(today) });
    expect(first.status).toBe(201);
    const again = await api()
      .post('/api/v1/daily-care/generate')
      .set(auth('groom'))
      .send({});
    expect(again.status).toBe(201);
    expect(again.body.createdCount).toBe(0);

    const list = await api()
      .get(`/api/v1/daily-care?date=${ymd(today)}&limit=100`)
      .set(auth('groom'));
    expect(list.status).toBe(200);
    expect(list.body.meta.total).toBeGreaterThan(0);
  });

  it('rejects a checklist for another day', async () => {
    const res = await api()
      .post('/api/v1/daily-care/generate')
      .set(auth('groom'))
      .send({ date: ymd(nextCareDay(today)) });
    expect(res.status).toBe(400);
  });

  it('only the groom ticks; every role can view', async () => {
    const list = await api()
      .get(`/api/v1/daily-care?date=${ymd(today)}&limit=1`)
      .set(auth('groom'));
    const id = list.body.data[0].id as string;

    for (const who of ['manager', 'trainer', 'vet', 'owner1']) {
      const res = await api()
        .patch(`/api/v1/daily-care/${id}/toggle`)
        .set(auth(who));
      expect(res.status).toBe(403);
    }
    const ok = await api()
      .patch(`/api/v1/daily-care/${id}/toggle`)
      .set(auth('groom'));
    expect(ok.status).toBe(200);
    expect(ok.body.completed).toBe(true);

    for (const who of ['manager', 'trainer', 'vet', 'owner1']) {
      const res = await api()
        .get(`/api/v1/daily-care?date=${ymd(today)}`)
        .set(auth(who));
      expect(res.status).toBe(200);
    }
  });

  it("closes yesterday's checklist: managers told what was undone, rows deleted", async () => {
    const yesterday = new Date(today.getTime() - 24 * 3600_000);
    const groom = await prisma.user.findUniqueOrThrow({
      where: { email: 'groom@racehorse.local' },
    });
    const horse = await prisma.horse.findFirstOrThrow({
      where: { deletedAt: null },
    });
    await prisma.dailyCareLog.createMany({
      data: [
        {
          horseId: horse.id,
          groomId: groom.id,
          date: yesterday,
          taskType: DailyCareTask.FEEDING,
          completed: true,
          completedAt: yesterday,
        },
        {
          horseId: horse.id,
          groomId: groom.id,
          date: yesterday,
          taskType: DailyCareTask.CLEANING,
        },
      ],
    });
    const since = new Date();

    // Any read of the checklist closes past days.
    const res = await api()
      .get(`/api/v1/daily-care?date=${ymd(yesterday)}`)
      .set(auth('vet'));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(0);
    expect(
      await prisma.dailyCareLog.count({ where: { date: { lt: today } } }),
    ).toBe(0);

    const manager = await prisma.user.findUniqueOrThrow({
      where: { email: 'manager@racehorse.local' },
    });
    const notes = await prisma.notification.findMany({
      where: {
        userId: manager.id,
        type: NotificationType.DAILY_CARE_INCOMPLETE,
        createdAt: { gte: since },
      },
    });
    expect(notes).toHaveLength(1);
    expect(notes[0].message).toContain(formatCareDay(yesterday));
    expect(notes[0].message).toContain('còn 1/2 việc');
    expect(notes[0].message).toContain(`${horse.name} (1)`);

    // A second pass finds nothing and sends nothing.
    await api().get('/api/v1/daily-care').set(auth('vet'));
    expect(
      await prisma.notification.count({
        where: {
          userId: manager.id,
          type: NotificationType.DAILY_CARE_INCOMPLETE,
          createdAt: { gte: since },
        },
      }),
    ).toBe(1);
  });
});
