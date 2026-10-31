import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';

describe('Race, care, finance and trial video workflows (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const tokens: Record<string, string> = {};
  const tag = `Cuong-${randomUUID()}`;
  let horseId: string;
  let raceId: string;
  let entryId: string;
  let ownerId: string;
  const auth = (role: string) => ({ Authorization: `Bearer ${tokens[role]}` });
  const api = () => request(app.getHttpServer());
  const future = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString();

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
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
    for (const [role, password] of [
      ['manager', 'Manager123!'],
      ['trainer', 'Trainer123!'],
      ['groom', 'Groom123!'],
      ['vet', 'Vet123!'],
      ['owner1', 'Owner123!'],
      ['owner2', 'Owner123!'],
    ]) {
      const res = await api()
        .post('/api/v1/auth/login')
        .send({ email: `${role}@racehorse.local`, password });
      expect(res.status).toBe(201);
      tokens[role] = res.body.accessToken;
    }
    ownerId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner1@racehorse.local' },
      })
    ).id;
    const horse = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: tag, ownerId });
    expect(horse.status).toBe(201);
    horseId = horse.body.id;
  });

  afterAll(async () => {
    if (horseId) {
      await prisma.trialVideo.deleteMany({ where: { horseId } });
      await prisma.horseExpense.deleteMany({ where: { horseId } });
      await prisma.trainingSession.deleteMany({ where: { horseId } });
      await prisma.vaccination.deleteMany({ where: { horseId } });
      await prisma.raceEntry.deleteMany({ where: { horseId } });
      await prisma.horse.delete({ where: { id: horseId } });
    }
    await prisma.race.deleteMany({ where: { name: { startsWith: tag } } });
    await app.close();
  });

  it('creates a race, registers, records results and returns owner history', async () => {
    const race = await api()
      .post('/api/v1/races')
      .set(auth('manager'))
      .send({ name: tag, date: future(7), prizePool: 10000000 });
    expect(race.status).toBe(201);
    raceId = race.body.id;
    const entry = await api()
      .post(`/api/v1/races/${raceId}/entries`)
      .set(auth('manager'))
      .send({ horseId });
    expect(entry.status).toBe(201);
    expect(entry.body.status).toBe('PENDING');
    entryId = entry.body.id;
    await prisma.race.update({
      where: { id: raceId },
      data: { date: new Date(future(-1)) },
    });
    const result = await api()
      .patch(`/api/v1/race-entries/${entryId}`)
      .set(auth('manager'))
      .send({ position: 1, time: '1:30.10', prizeWon: 1500000 });
    expect(result.status).toBe(200);
    expect(result.body.status).toBe('COMPLETED');
    const history = await api()
      .get(`/api/v1/horses/${horseId}/race-entries`)
      .set(auth('owner1'));
    expect(history.status).toBe(200);
    expect(history.body.data[0]).toMatchObject({
      status: 'COMPLETED',
      position: 1,
      time: '1:30.10',
      prizeWon: 1500000,
    });
    expect(
      (
        await api()
          .get(`/api/v1/horses/${horseId}/race-entries`)
          .set(auth('owner2'))
      ).status,
    ).toBe(403);
  });

  it.each([-1, 0, 2])('rejects registration %s days from now', async (days) => {
    const race = await prisma.race.create({
      data: { name: `${tag}-${days}`, date: new Date(future(days)) },
    });
    const res = await api()
      .post(`/api/v1/races/${race.id}/entries`)
      .set(auth('manager'))
      .send({ horseId });
    expect(res.status).toBe(400);
  });

  it.each([
    { locked: true },
    { status: 'RETIRED' as const },
    { healthStatus: 'QUARANTINED' as const },
    { healthStatus: 'INJURED' as const },
  ])('rejects an ineligible horse: %j', async (condition) => {
    const race = await prisma.race.create({
      data: { name: `${tag}-blocked`, date: new Date(future(7)) },
    });
    await prisma.horse.update({ where: { id: horseId }, data: condition });
    try {
      expect(
        (
          await api()
            .post(`/api/v1/races/${race.id}/entries`)
            .set(auth('manager'))
            .send({ horseId })
        ).status,
      ).toBe(400);
    } finally {
      await prisma.horse.update({
        where: { id: horseId },
        data: { locked: false, status: 'ACTIVE', healthStatus: 'FIT' },
      });
    }
  });

  it('records actual expenses and limits financial reports to the owner and manager', async () => {
    const expense = {
      horseId,
      date: new Date().toISOString(),
      category: 'FEEDING',
      description: 'Feed invoice',
      amount: 250000,
    };
    expect(
      (
        await api()
          .post('/api/v1/reports/expenses')
          .set(auth('owner1'))
          .send(expense)
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .post('/api/v1/reports/expenses')
          .set(auth('manager'))
          .send({ ...expense, amount: -1 })
      ).status,
    ).toBe(400);
    expect(
      (
        await api()
          .post('/api/v1/reports/expenses')
          .set(auth('manager'))
          .send(expense)
      ).status,
    ).toBe(201);
    for (const role of ['owner1', 'manager']) {
      const res = await api()
        .get('/api/v1/reports/finances')
        .query({ horseId })
        .set(auth(role));
      expect(res.status).toBe(200);
      expect(res.body.summary).toMatchObject({
        totalPrizeMoney: 1500000,
        totalCost: 250000,
        netBalance: 1250000,
      });
      expect(res.body.horses).toHaveLength(1);
    }
    expect(
      (
        await api()
          .get('/api/v1/reports/finances')
          .query({ horseId })
          .set(auth('owner2'))
      ).status,
    ).toBe(403);
    const other = await api()
      .get('/api/v1/reports/finances')
      .set(auth('owner2'));
    expect(
      other.body.horses.some((h: { horseId: string }) => h.horseId === horseId),
    ).toBe(false);
    expect(
      (await api().get('/api/v1/reports/finances').set(auth('groom'))).status,
    ).toBe(403);
    expect(
      (
        await api()
          .get('/api/v1/reports/finances')
          .query({ from: future(2), to: future(-2) })
          .set(auth('manager'))
      ).status,
    ).toBe(400);
    const empty = await api()
      .get('/api/v1/reports/finances')
      .query({ horseId, from: future(-10), to: future(-5) })
      .set(auth('owner1'));
    expect(empty.body.summary.totalCost).toBe(0);
    expect(empty.body.summary.totalPrizeMoney).toBe(0);
  });

  it.each(['WITHDRAWN', 'DID_NOT_START', 'PENDING'])(
    'clears stale results and winnings when status becomes %s',
    async (status) => {
      const res = await api()
        .patch(`/api/v1/race-entries/${entryId}`)
        .set(auth('manager'))
        .send({ status, position: 1, time: 'stale', prizeWon: 100 });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        status,
        position: null,
        time: null,
        prizeWon: null,
      });
      const report = await api()
        .get('/api/v1/reports/finances')
        .query({ horseId })
        .set(auth('owner1'));
      expect(report.body.summary.totalPrizeMoney).toBe(0);
    },
  );

  it('supports farrier schedules and records beyond the first 100 rows', async () => {
    const farrier = await api()
      .post(`/api/v1/horses/${horseId}/vaccinations`)
      .set(auth('vet'))
      .send({
        careType: 'FARRIER',
        vaccineName: 'Hoof check',
        date: new Date().toISOString(),
        nextDueDate: future(14),
      });
    expect(farrier.status).toBe(201);
    await prisma.vaccination.createMany({
      data: Array.from({ length: 101 }, () => ({
        horseId,
        careType: 'FARRIER',
        vaccineName: tag,
        date: new Date(),
        nextDueDate: new Date(future(14)),
      })),
    });
    await prisma.race.createMany({
      data: Array.from({ length: 101 }, () => ({
        name: `${tag}-page`,
        date: new Date(future(7)),
      })),
    });
    for (const [path, query, role] of [
      ['/api/v1/races', { search: `${tag}-page` }, 'manager'],
      ['/api/v1/vaccinations', { careType: 'FARRIER' }, 'vet'],
    ] as const) {
      const first = await api()
        .get(path)
        .query({ ...query, page: 1, limit: 100 })
        .set(auth(role));
      const second = await api()
        .get(path)
        .query({ ...query, page: 2, limit: 100 })
        .set(auth(role));
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(first.body.data).toHaveLength(100);
      expect(second.body.data.length).toBeGreaterThan(0);
      const ids = new Set(first.body.data.map((r: { id: string }) => r.id));
      expect(
        second.body.data.every((r: { id: string }) => !ids.has(r.id)),
      ).toBe(true);
    }
  });

  it('attributes Groom results and lets a trainer confirm without changing the recorder', async () => {
    const session = await api()
      .post(`/api/v1/horses/${horseId}/sessions`)
      .set(auth('trainer'))
      .send({ scheduledAt: future(1), type: 'Trial' });
    expect(session.status).toBe(201);
    const path = `/api/v1/sessions/${session.body.id}`;
    const result = await api()
      .patch(path)
      .set(auth('groom'))
      .send({ status: 'DONE', resultMetric: 'seconds', resultValue: 75 });
    expect(result.status).toBe(200);
    expect(result.body.resultRecordedBy.role).toBe('GROOM');
    expect(result.body.resultConfirmed).toBe(false);
    expect(
      (
        await api()
          .patch(path)
          .set(auth('groom'))
          .send({ resultConfirmed: true })
      ).status,
    ).toBe(403);
    expect(
      (
        await api()
          .patch(path)
          .set(auth('trainer'))
          .send({ resultConfirmed: true, resultValue: 1 })
      ).status,
    ).toBe(400);
    const confirmed = await api()
      .patch(path)
      .set(auth('trainer'))
      .send({ resultConfirmed: true });
    expect(confirmed.status).toBe(200);
    expect(confirmed.body.resultConfirmed).toBe(true);
    expect(confirmed.body.resultRecordedBy.id).toBe(
      result.body.resultRecordedBy.id,
    );
    expect(confirmed.body.resultValue).toBe(75);
  });

  it('lets owners view only their own trial videos and rejects unsafe URLs', async () => {
    const path = `/api/v1/horses/${horseId}/trial-videos`;
    const body = {
      title: 'Trial',
      videoUrl: 'https://example.com/trial.mp4',
      recordedAt: new Date().toISOString(),
    };
    expect(
      (
        await api()
          .post(path)
          .set(auth('trainer'))
          .send({ ...body, videoUrl: 'javascript:alert(1)' })
      ).status,
    ).toBe(400);
    const created = await api().post(path).set(auth('trainer')).send(body);
    expect(created.status).toBe(201);
    const own = await api().get(path).set(auth('owner1'));
    expect(own.status).toBe(200);
    expect(own.body[0].id).toBe(created.body.id);
    expect((await api().get(path).set(auth('owner2'))).status).toBe(403);
    expect(
      (await api().delete(`${path}/${created.body.id}`).set(auth('owner1')))
        .status,
    ).toBe(403);
    expect(
      (await api().delete(`${path}/${created.body.id}`).set(auth('manager')))
        .status,
    ).toBe(200);
  });
});
