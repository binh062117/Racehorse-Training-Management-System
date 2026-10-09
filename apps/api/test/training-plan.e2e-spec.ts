import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 7 — Training Plan & Training Lock. Covers training-plan CRUD +
 * ownership, PATCH /horses/:id/lock (VET-only), and the rule blocking new
 * session creation while a horse is locked. See docs/specs/phase-7-training-plan-lock.md §9.
 */
describe('Training plans & lock (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseAId: string; // unlocked
  let horseBId: string; // gets locked mid-suite
  let planId: string;

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
    tokens.groom = await login('groom@racehorse.local', 'Groom123!');
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');
    tokens.owner2 = await login('owner2@racehorse.local', 'Owner123!');

    owner1Id = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner1@racehorse.local' },
      })
    ).id;

    const a = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Plan Horse A', ownerId: owner1Id });
    horseAId = a.body.id;

    const b = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Plan Horse B', ownerId: owner1Id });
    horseBId = b.body.id;
  });

  afterAll(async () => {
    await prisma.trainingSession.deleteMany({
      where: { horseId: { in: [horseAId, horseBId] } },
    });
    await prisma.trainingPlan.deleteMany({
      where: { horseId: { in: [horseAId, horseBId] } },
    });
    await prisma.horse.deleteMany({
      where: { id: { in: [horseAId, horseBId] } },
    });
    await app.close();
  });

  it('TRAINER creates a training plan (201)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('trainer'))
      .send({
        goal: 'Build stamina',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.trainer.email).toBe('trainer@racehorse.local');
    planId = res.body.id;
  });

  it('rejects a plan without goal (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('trainer'))
      .send({ startDate: new Date().toISOString() });
    expect(res.status).toBe(400);
  });

  it('rejects endDate before startDate (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('trainer'))
      .send({
        goal: 'x',
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() - 86_400_000).toISOString(),
      });
    expect(res.status).toBe(400);
  });

  it('VET/OWNER/MANAGER/GROOM cannot create a training plan (403)', async () => {
    const vetRes = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('vet'))
      .send({ goal: 'x', startDate: new Date().toISOString() });
    expect(vetRes.status).toBe(403);

    const ownerRes = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('owner1'))
      .send({ goal: 'x', startDate: new Date().toISOString() });
    expect(ownerRes.status).toBe(403);

    const managerRes = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('manager'))
      .send({ goal: 'x', startDate: new Date().toISOString() });
    expect(managerRes.status).toBe(403);

    const groomRes = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('groom'))
      .send({ goal: 'x', startDate: new Date().toISOString() });
    expect(groomRes.status).toBe(403);
  });

  it('creating a plan for an unknown horse is 404', async () => {
    const res = await api()
      .post(
        '/api/v1/horses/00000000-0000-0000-0000-000000000000/training-plans',
      )
      .set(auth('trainer'))
      .send({ goal: 'x', startDate: new Date().toISOString() });
    expect(res.status).toBe(404);
  });

  it('rejects creating a plan for a RETIRED horse (400)', async () => {
    // Temporarily set horseA to RETIRED
    await prisma.horse.update({
      where: { id: horseAId },
      data: { status: 'RETIRED' },
    });

    const res = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('trainer'))
      .send({ goal: 'Stamina training', startDate: new Date().toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('RETIRED');

    // Restore horseA to ACTIVE
    await prisma.horse.update({
      where: { id: horseAId },
      data: { status: 'ACTIVE' },
    });
  });

  it('rejects creating a plan for a QUARANTINED horse (400)', async () => {
    // Temporarily set horseA healthStatus to QUARANTINED
    await prisma.horse.update({
      where: { id: horseAId },
      data: { healthStatus: 'QUARANTINED' },
    });

    const res = await api()
      .post(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('trainer'))
      .send({ goal: 'Stamina training', startDate: new Date().toISOString() });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('QUARANTINED');

    // Restore horseA healthStatus to FIT
    await prisma.horse.update({
      where: { id: horseAId },
      data: { healthStatus: 'FIT' },
    });
  });

  it('owner1 sees plans for their horse; owner2 is forbidden', async () => {
    const mine = await api()
      .get(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBeGreaterThan(0);

    const notMine = await api()
      .get(`/api/v1/horses/${horseAId}/training-plans`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });

  it('GET /training-plans/:id includes empty sessions list', async () => {
    const res = await api()
      .get(`/api/v1/training-plans/${planId}`)
      .set(auth('owner1'));
    expect(res.status).toBe(200);
    expect(res.body.sessions).toEqual([]);
  });

  it('GET /training-plans lists all visible plans for TRAINER', async () => {
    const res = await api()
      .get('/api/v1/training-plans')
      .set(auth('trainer'));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(res.body.data[0].horse).toBeDefined();
    expect(res.body.data[0].trainer).toBeDefined();
  });

  it('TRAINER edits the plan goal (200)', async () => {
    const res = await api()
      .patch(`/api/v1/training-plans/${planId}`)
      .set(auth('trainer'))
      .send({ goal: 'Build stamina and speed' });
    expect(res.status).toBe(200);
    expect(res.body.goal).toBe('Build stamina and speed');
  });

  it('rejects PATCH endDate before the existing startDate (400)', async () => {
    const res = await api()
      .patch(`/api/v1/training-plans/${planId}`)
      .set(auth('trainer'))
      .send({ endDate: new Date(Date.now() - 365 * 86_400_000).toISOString() });
    expect(res.status).toBe(400);
  });

  it('VET cannot edit a training plan (403)', async () => {
    const res = await api()
      .patch(`/api/v1/training-plans/${planId}`)
      .set(auth('vet'))
      .send({ goal: 'nope' });
    expect(res.status).toBe(403);
  });

  it('VET locks horseB with a reason (200)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${horseBId}/lock`)
      .set(auth('vet'))
      .send({ locked: true, reason: 'Suspected tendon strain' });
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(true);
    expect(res.body.lockReason).toBe('Suspected tendon strain');
  });

  it('MANAGER cannot lock a horse (403)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${horseBId}/lock`)
      .set(auth('manager'))
      .send({ locked: true });
    expect(res.status).toBe(403);
  });

  it('TRAINER cannot create a session for a locked horse (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseBId}/sessions`)
      .set(auth('trainer'))
      .send({ scheduledAt: new Date().toISOString(), type: 'gallop' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.message).toContain('locked');
  });

  it('TRAINER can still create a session for an unlocked horse', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseAId}/sessions`)
      .set(auth('trainer'))
      .send({ scheduledAt: new Date().toISOString(), type: 'gallop' });
    expect(res.status).toBe(201);
  });

  it('TRAINER can create a session linked to a plan on the same horse', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseAId}/sessions`)
      .set(auth('trainer'))
      .send({
        // +2h — Phase 9's EX-01 would otherwise conflict with the session
        // the previous test just created for horseA at "now".
        scheduledAt: new Date(Date.now() + 2 * 3_600_000).toISOString(),
        type: 'sprint',
        planId,
      });
    expect(res.status).toBe(201);
    expect(res.body.planId).toBe(planId);
  });

  it('rejects a planId that belongs to a different horse (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseBId}/sessions`)
      .set(auth('trainer'))
      .send({ scheduledAt: new Date().toISOString(), type: 'trot', planId });
    // horseB is still locked at this point — either rule can fire first, but
    // both are VALIDATION_ERROR, so unlock first to isolate the planId check.
    expect(res.status).toBe(400);
  });

  it('VET unlocks horseB and clears the reason (200)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${horseBId}/lock`)
      .set(auth('vet'))
      .send({ locked: false });
    expect(res.status).toBe(200);
    expect(res.body.locked).toBe(false);
    expect(res.body.lockReason).toBeNull();
  });

  it('TRAINER can create a session for horseB after unlocking', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseBId}/sessions`)
      .set(auth('trainer'))
      .send({ scheduledAt: new Date().toISOString(), type: 'trot' });
    expect(res.status).toBe(201);
  });

  it('rejects a planId for a different horse once unlocked (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseBId}/sessions`)
      .set(auth('trainer'))
      .send({ scheduledAt: new Date().toISOString(), type: 'trot', planId });
    expect(res.status).toBe(400);
  });
});
