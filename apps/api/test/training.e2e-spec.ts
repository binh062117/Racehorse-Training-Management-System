import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 3 — Training sessions. Covers create (TRAINER), horse-scoped listing +
 * ownership, session detail ownership, the PLANNED→DONE/CANCELLED state machine,
 * the "DONE needs a result" rule, and the GROOM field whitelist.
 * See docs/specs/phase-3-training.md §9. Assumes the Phase 3 seed has run.
 */
describe('Training sessions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseId: string;
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
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');
    tokens.owner2 = await login('owner2@racehorse.local', 'Owner123!');

    owner1Id = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner1@racehorse.local' },
      })
    ).id;

    const horse = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Trainee', ownerId: owner1Id });
    horseId = horse.body.id;
  });

  afterAll(async () => {
    await prisma.trainingSession.deleteMany({ where: { horseId } });
    await prisma.horseLockEvent.deleteMany({ where: { horseId: horseId } });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    await app.close();
  });

  const createSession = async (who: string, body: Record<string, unknown>) =>
    api().post(`/api/v1/horses/${horseId}/sessions`).set(auth(who)).send(body);

  it('TRAINER creates a session (201, PLANNED)', async () => {
    const res = await createSession('trainer', {
      scheduledAt: new Date(Date.now() + 86_400_000).toISOString(),
      type: 'gallop',
      notes: 'easy',
    });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PLANNED');
    expect(res.body.trainer.email).toBe('trainer@racehorse.local');
    expect(res.body.horseId).toBe(horseId);
    sessionIds.push(res.body.id);
  });

  it('rejects a session without type (400)', async () => {
    const res = await createSession('trainer', {
      scheduledAt: new Date().toISOString(),
    });
    expect(res.status).toBe(400);
  });

  it('GROOM cannot create a session (403)', async () => {
    const res = await createSession('groom', {
      scheduledAt: new Date().toISOString(),
      type: 'x',
    });
    expect(res.status).toBe(403);
  });

  it('OWNER cannot create a session (403)', async () => {
    const res = await createSession('owner1', {
      scheduledAt: new Date().toISOString(),
      type: 'x',
    });
    expect(res.status).toBe(403);
  });

  it('creating on an unknown horse is 404', async () => {
    const res = await api()
      .post('/api/v1/horses/00000000-0000-0000-0000-000000000000/sessions')
      .set(auth('trainer'))
      .send({ scheduledAt: new Date().toISOString(), type: 'x' });
    expect(res.status).toBe(404);
  });

  it('owner sees sessions for their own horse; another owner gets 403', async () => {
    const mine = await api()
      .get(`/api/v1/horses/${horseId}/sessions`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBeGreaterThan(0);

    const notMine = await api()
      .get(`/api/v1/horses/${horseId}/sessions`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });

  it('GET /sessions/:id enforces ownership', async () => {
    const ok = await api()
      .get(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('owner1'));
    expect(ok.status).toBe(200);

    const forbidden = await api()
      .get(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('owner2'));
    expect(forbidden.status).toBe(403);

    const missing = await api()
      .get('/api/v1/sessions/00000000-0000-0000-0000-000000000000')
      .set(auth('manager'));
    expect(missing.status).toBe(404);
  });

  it('TRAINER edits notes while PLANNED (200)', async () => {
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('trainer'))
      .send({ notes: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('updated');
  });

  it('rejects DONE without a result (400)', async () => {
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('trainer'))
      .send({ status: 'DONE' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('GROOM marks DONE with a result (200)', async () => {
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('groom'))
      .send({
        status: 'DONE',
        resultMetric: 'time_1000m_s',
        resultValue: 63.5,
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('DONE');
    expect(res.body.resultValue).toBe(63.5);
  });

  it('GROOM cannot edit non-result fields (403)', async () => {
    const s = await createSession('trainer', {
      scheduledAt: new Date().toISOString(),
      type: 'walk',
    });
    sessionIds.push(s.body.id);
    const res = await api()
      .patch(`/api/v1/sessions/${s.body.id}`)
      .set(auth('groom'))
      .send({ type: 'sprint' });
    expect(res.status).toBe(403);
  });

  it('cannot PATCH a session that is already DONE (400)', async () => {
    const res = await api()
      .patch(`/api/v1/sessions/${sessionIds[0]}`)
      .set(auth('trainer'))
      .send({ notes: 'too late' });
    expect(res.status).toBe(400);
  });

  it('a session can be CANCELLED without a result (200)', async () => {
    const s = await createSession('trainer', {
      // +2h — Phase 9's EX-01 rejects a 2nd PLANNED session within 60' of
      // another for the same horse; the 'walk' session above is still
      // PLANNED at this point.
      scheduledAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
      type: 'rest-check',
    });
    sessionIds.push(s.body.id);
    const res = await api()
      .patch(`/api/v1/sessions/${s.body.id}`)
      .set(auth('trainer'))
      .send({ status: 'CANCELLED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
  });

  it('filters by status', async () => {
    const res = await api()
      .get(`/api/v1/horses/${horseId}/sessions`)
      .query({ status: 'PLANNED' })
      .set(auth('trainer'));
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((s: { status: string }) => s.status === 'PLANNED'),
    ).toBe(true);
  });
});
