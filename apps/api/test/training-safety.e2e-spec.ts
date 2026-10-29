import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 9 — Training safety rules (Sprint 2 remainder). Covers EX-01
 * (reject a session within 60' of an existing PLANNED one for the same
 * horse) and UC-12 (fitness threshold warning notification when a session
 * is marked DONE with resultMetric="heart_rate_max" > 195).
 * See docs/specs/phase-9-training-safety.md §9.
 */
describe('Training safety rules (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseAId: string;
  let horseBId: string;
  const sessionIds: string[] = [];

  const api = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  const login = async (email: string, password: string): Promise<string> => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  };

  const userId = async (email: string): Promise<string> =>
    (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

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
    tokens.groom = await login('groom@racehorse.local', 'Groom123!');
    tokens.vet = await login('vet@racehorse.local', 'Vet123!');
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');

    owner1Id = await userId('owner1@racehorse.local');

    const a = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Safety Horse A', ownerId: owner1Id });
    horseAId = a.body.id;

    const b = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Safety Horse B', ownerId: owner1Id });
    horseBId = b.body.id;
  });

  afterAll(async () => {
    await prisma.trainingSession.deleteMany({
      where: { horseId: { in: [horseAId, horseBId] } },
    });
    await prisma.notification.deleteMany({
      where: { message: { contains: 'E2E Safety Horse A' } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: [horseAId, horseBId] } },
    });
    await app.close();
  });

  const baseTime = new Date('2026-11-01T08:00:00.000Z');

  const createSession = (horseId: string, isoTime: string, type = 'gallop') =>
    api()
      .post(`/api/v1/horses/${horseId}/sessions`)
      .set(auth('trainer'))
      .send({ scheduledAt: isoTime, type });

  it('TRAINER creates the first session for horse A (201)', async () => {
    const res = await createSession(horseAId, baseTime.toISOString());
    expect(res.status).toBe(201);
    sessionIds.push(res.body.id);
  });

  it('rejects a 2nd session for the same horse within 60 minutes (409 CONFLICT)', async () => {
    const within = new Date(baseTime.getTime() + 30 * 60_000).toISOString();
    const res = await createSession(horseAId, within);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('accepts a session exactly 61 minutes away (201, no conflict)', async () => {
    const outside = new Date(baseTime.getTime() + 61 * 60_000).toISOString();
    const res = await createSession(horseAId, outside);
    expect(res.status).toBe(201);
    sessionIds.push(res.body.id);
  });

  it('a different horse at the same time is unaffected (201)', async () => {
    const res = await createSession(horseBId, baseTime.toISOString());
    expect(res.status).toBe(201);
    sessionIds.push(res.body.id);
  });

  it('the conflict message names the clashing session and its time in Vietnam time', async () => {
    const within = new Date(baseTime.getTime() + 15 * 60_000).toISOString();
    const res = await createSession(horseAId, within);
    expect(res.status).toBe(409);
    // baseTime 08:00Z = 15:00 in Asia/Ho_Chi_Minh.
    expect(res.body.error.message).toContain('"gallop"');
    expect(res.body.error.message).toContain('15:00');
    expect(res.body.error.message).toContain('60 phút');
  });

  it('moving a planned session onto another one is rejected (409 CONFLICT)', async () => {
    const onTop = new Date(baseTime.getTime() + 20 * 60_000).toISOString();
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[1]}`)
      .set(auth('trainer'))
      .send({ scheduledAt: onTop });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('moving a planned session a little does not clash with itself (200)', async () => {
    // sessionIds[0] sits at baseTime; 30 min earlier is still 91 min from sessionIds[1].
    const earlier = new Date(baseTime.getTime() - 30 * 60_000).toISOString();
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('trainer'))
      .send({ scheduledAt: earlier });
    expect(res.status).toBe(200);
    expect(res.body.scheduledAt).toBe(earlier);
  });

  it('a cancelled session no longer blocks its time slot (201)', async () => {
    const slot = new Date(baseTime.getTime() + 4 * 60 * 60_000);
    const first = await createSession(horseAId, slot.toISOString());
    expect(first.status).toBe(201);
    sessionIds.push(first.body.id);
    const cancel = await api()
      .patch(`/api/v1/sessions/${first.body.id}`)
      .set(auth('trainer'))
      .send({ status: 'CANCELLED' });
    expect(cancel.status).toBe(200);

    const again = await createSession(
      horseAId,
      new Date(slot.getTime() + 10 * 60_000).toISOString(),
    );
    expect(again.status).toBe(201);
    sessionIds.push(again.body.id);
  });

  it('Training Lock still takes priority over the conflict rule (400, not 409)', async () => {
    await api()
      .patch(`/api/v1/horses/${horseBId}/lock`)
      .set(auth('vet'))
      .send({ locked: true, reason: 'safety-rule test lock' });

    const res = await createSession(horseBId, baseTime.toISOString());
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');

    await api()
      .patch(`/api/v1/horses/${horseBId}/lock`)
      .set(auth('vet'))
      .send({ locked: false });
  });

  it('marking a session DONE with heart_rate_max > 195 notifies trainer + groom + owner', async () => {
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('groom'))
      .send({
        status: 'DONE',
        resultMetric: 'heart_rate_max',
        resultValue: 210,
      });
    expect(res.status).toBe(200);

    for (const who of ['trainer', 'groom', 'owner1'] as const) {
      const notifs = await api().get('/api/v1/notifications').set(auth(who));
      expect(notifs.status).toBe(200);
      expect(
        notifs.body.data.some(
          (n: { type: string; message: string }) =>
            n.type === 'FITNESS_WARNING' &&
            n.message.includes('E2E Safety Horse A'),
        ),
      ).toBe(true);
    }
  });

  it('marking a session DONE with heart_rate_max below threshold does not notify (200, no new warning)', async () => {
    const before = await prisma.notification.count({
      where: { type: 'FITNESS_WARNING' },
    });
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[1]}`)
      .set(auth('groom'))
      .send({
        status: 'DONE',
        resultMetric: 'heart_rate_max',
        resultValue: 180,
      });
    expect(res.status).toBe(200);
    const after = await prisma.notification.count({
      where: { type: 'FITNESS_WARNING' },
    });
    expect(after).toBe(before);
  });

  it('marking a session DONE with a different metric does not evaluate the threshold (200, no warning)', async () => {
    const before = await prisma.notification.count({
      where: { type: 'FITNESS_WARNING' },
    });
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[2]}`)
      .set(auth('groom'))
      .send({ status: 'DONE', resultMetric: 'time_1200m_s', resultValue: 999 });
    expect(res.status).toBe(200);
    const after = await prisma.notification.count({
      where: { type: 'FITNESS_WARNING' },
    });
    expect(after).toBe(before);
  });
});
