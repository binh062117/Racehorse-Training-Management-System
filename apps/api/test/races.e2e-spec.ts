import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 6 — Races. Covers CRUD on /races, /races/:id/entries,
 * /horses/:id/race-entries (ownership), and /race-entries/:id.
 * See docs/specs/phase-6-pedigree.md §9.
 */
describe('Races (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseId: string;
  let unreadyId: string;
  let raceId: string;
  let entryId: string;

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
    tokens.vet = await login('vet@racehorse.local', 'Vet123!');
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
      .send({ name: 'E2E Racer', ownerId: owner1Id });
    horseId = horse.body.id;

    const unready = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Unready Racer', ownerId: owner1Id });
    unreadyId = unready.body.id;

    // Make 'E2E Racer' race-ready: a complete plan + a passing vet score.
    const start = new Date();
    const plan = await api()
      .post(`/api/v1/horses/${horseId}/training-plans`)
      .set(auth('trainer'))
      .send({
        goal: 'E2E race prep',
        startDate: start.toISOString(),
        endDate: new Date(start.getTime() + 7 * 86_400_000).toISOString(),
        targetDistanceM: 1600,
      });
    expect(plan.status).toBe(201);
    const session = await api()
      .post(`/api/v1/horses/${horseId}/sessions`)
      .set(auth('trainer'))
      .send({
        scheduledAt: new Date(start.getTime() + 3_600_000).toISOString(),
        type: 'gallop',
        distanceM: 1600,
        planId: plan.body.id,
      });
    expect(session.status).toBe(201);
    await prisma.trainingSession.update({
      where: { id: session.body.id },
      data: { scheduledAt: new Date(Date.now() - 1 * 3600_000) },
    });
    const done = await api()
      .patch(`/api/v1/sessions/${session.body.id}`)
      .set(auth('trainer'))
      .send({ status: 'DONE', finishTimeSec: 98.4 });
    expect(done.status).toBe(200);
    const score = await api()
      .post(`/api/v1/horses/${horseId}/fitness-assessment`)
      .set(auth('vet'))
      .send({
        speedScore: 18,
        staminaScore: 17,
        conditionScore: 17,
        recoveryScore: 17,
        moraleScore: 16,
      });
    expect(score.body.assessment.totalScore).toBe(85);
  });

  afterAll(async () => {
    await prisma.raceEntry.deleteMany({
      where: { horseId: { in: [horseId, unreadyId] } },
    });
    await prisma.trainingSession.deleteMany({
      where: { horseId: { in: [horseId, unreadyId] } },
    });
    await prisma.trainingPlan.deleteMany({
      where: { horseId: { in: [horseId, unreadyId] } },
    });
    await prisma.fitnessAssessment.deleteMany({
      where: { horseId: { in: [horseId, unreadyId] } },
    });
    await prisma.horse.deleteMany({ where: { id: unreadyId } });
    await prisma.horseLockEvent.deleteMany({ where: { horseId: horseId } });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    if (raceId) await prisma.race.deleteMany({ where: { id: raceId } });
    await app.close();
  });

  it('MANAGER creates a race (201)', async () => {
    const res = await api().post('/api/v1/races').set(auth('manager')).send({
      name: 'E2E Cup',
      date: new Date(Date.now() + 7 * 86400000).toISOString(),
      venue: 'Test Track',
    });
    expect(res.status).toBe(201);
    raceId = res.body.id;
  });

  it('rejects a race without name (400)', async () => {
    const res = await api()
      .post('/api/v1/races')
      .set(auth('manager'))
      .send({ date: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it('OWNER cannot create a race (403)', async () => {
    const res = await api()
      .post('/api/v1/races')
      .set(auth('owner1'))
      .send({ name: 'nope', date: new Date().toISOString() });
    expect(res.status).toBe(403);
  });

  it('any logged-in role can list races (200)', async () => {
    const res = await api().get('/api/v1/races').set(auth('owner2'));
    expect(res.status).toBe(200);
    expect(res.body.data.some((r: { id: string }) => r.id === raceId)).toBe(
      true,
    );
  });

  it('GET /races/:id returns the race with empty entries', async () => {
    const res = await api().get(`/api/v1/races/${raceId}`).set(auth('owner1'));
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
  });

  it('MANAGER patches the race (200)', async () => {
    const res = await api()
      .patch(`/api/v1/races/${raceId}`)
      .set(auth('manager'))
      .send({ venue: 'New Track' });
    expect(res.status).toBe(200);
    expect(res.body.venue).toBe('New Track');
  });

  it('a horse without a complete plan and a passing score cannot be entered (400)', async () => {
    const res = await api()
      .post(`/api/v1/races/${raceId}/entries`)
      .set(auth('manager'))
      .send({ horseId: unreadyId });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('giáo án');
    expect(res.body.error.message).toContain('thể lực');
  });

  it('GET /races/readiness explains who can race and why not', async () => {
    const res = await api().get('/api/v1/races/readiness').set(auth('manager'));
    expect(res.status).toBe(200);
    const ready = res.body.find(
      (r: { horseId: string }) => r.horseId === horseId,
    );
    const unready = res.body.find(
      (r: { horseId: string }) => r.horseId === unreadyId,
    );
    expect(ready.ready).toBe(true);
    expect(unready.ready).toBe(false);
    expect(unready.reasons.length).toBeGreaterThan(0);
  });

  it('MANAGER adds an entry for the horse (201)', async () => {
    const res = await api()
      .post(`/api/v1/races/${raceId}/entries`)
      .set(auth('manager'))
      .send({ horseId });
    expect(res.status).toBe(201);
    expect(res.body.horse.id).toBe(horseId);
    entryId = res.body.id;
  });

  it('rejects a duplicate entry for the same horse (409)', async () => {
    const res = await api()
      .post(`/api/v1/races/${raceId}/entries`)
      .set(auth('manager'))
      .send({ horseId });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('rejects an entry for an unknown horse (404)', async () => {
    const res = await api()
      .post(`/api/v1/races/${raceId}/entries`)
      .set(auth('manager'))
      .send({ horseId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(404);
  });

  it('rejects an entry for a locked horse (400)', async () => {
    // Create another horse that is locked
    const lockedHorse = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'Locked Racer', ownerId: owner1Id });
    const lockedHorseId = lockedHorse.body.id;

    await prisma.horse.update({
      where: { id: lockedHorseId },
      data: { locked: true, lockReason: 'Injured tendon' },
    });

    const res = await api()
      .post(`/api/v1/races/${raceId}/entries`)
      .set(auth('manager'))
      .send({ horseId: lockedHorseId });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('bị khóa');

    await prisma.horse.delete({ where: { id: lockedHorseId } });
  });

  it('OWNER cannot add an entry (403)', async () => {
    const res = await api()
      .post(`/api/v1/races/${raceId}/entries`)
      .set(auth('owner1'))
      .send({ horseId });
    expect(res.status).toBe(403);
  });

  it("owner1 sees the horse's race entries; owner2 is forbidden", async () => {
    const mine = await api()
      .get(`/api/v1/horses/${horseId}/race-entries`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBe(1);
    expect(mine.body.data[0].race.id).toBe(raceId);

    const notMine = await api()
      .get(`/api/v1/horses/${horseId}/race-entries`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });

  it('MANAGER records the result on the entry (200)', async () => {
    const res = await api()
      .patch(`/api/v1/race-entries/${entryId}`)
      .set(auth('manager'))
      .send({ position: 1, time: '1:38.20' });
    expect(res.status).toBe(200);
    expect(res.body.position).toBe(1);
    expect(res.body.time).toBe('1:38.20');
  });

  it('TRAINER cannot patch a race entry (403)', async () => {
    const res = await api()
      .patch(`/api/v1/race-entries/${entryId}`)
      .set(auth('trainer'))
      .send({ position: 2 });
    expect(res.status).toBe(403);
  });
});
