import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 8 — Incidents. Covers incident CRUD + ownership, forward-only status,
 * healthRecordId validation, and the auto-lock (HIGH on create) / auto-unlock
 * (RESOLVED while locked) sync with Training Lock (Phase 7).
 * See docs/specs/phase-8-health-injury.md §9.
 */
describe('Incidents (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseId: string; // will be auto-locked by the HIGH incident
  let lowIncidentId: string;
  let highIncidentId: string;

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
    tokens.groom = await login('groom@racehorse.local', 'Groom123!');
    tokens.vet = await login('vet@racehorse.local', 'Vet123!');
    tokens.trainer = await login('trainer@racehorse.local', 'Trainer123!');
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
      .send({ name: 'E2E Incident Horse', ownerId: owner1Id });
    horseId = horse.body.id;
  });

  afterAll(async () => {
    await prisma.incidentReport.deleteMany({ where: { horseId } });
    // Notifications reference no horseId — clean up by message text (covers
    // both owner1's copy and every MANAGER's copy).
    await prisma.notification.deleteMany({
      where: { message: { contains: 'E2E Incident Horse' } },
    });
    await prisma.horseLockEvent.deleteMany({ where: { horseId: horseId } });
    await prisma.incidentReport.deleteMany({ where: { horseId: horseId } });
    await prisma.healthRecord.deleteMany({ where: { horseId: horseId } });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    await app.close();
  });

  it('GROOM reports a LOW incident (201), horse stays unlocked', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ description: 'Minor scrape', severity: 'LOW' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('OPEN');
    lowIncidentId = res.body.id;

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.locked).toBe(false);
  });

  it('rejects an incident without description (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ severity: 'LOW' });
    expect(res.status).toBe(400);
  });

  it('VET/TRAINER/OWNER cannot report an incident (403)', async () => {
    for (const who of ['vet', 'trainer', 'owner1']) {
      const res = await api()
        .post(`/api/v1/horses/${horseId}/incidents`)
        .set(auth(who))
        .send({ description: 'x', severity: 'LOW' });
      expect(res.status).toBe(403);
    }
  });

  it('reporting on an unknown horse is 404', async () => {
    const res = await api()
      .post('/api/v1/horses/00000000-0000-0000-0000-000000000000/incidents')
      .set(auth('groom'))
      .send({ description: 'x', severity: 'LOW' });
    expect(res.status).toBe(404);
  });

  it('GROOM reports a HIGH incident — auto-locks the horse (201)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ description: 'Fall during transport', severity: 'HIGH' });
    expect(res.status).toBe(201);
    highIncidentId = res.body.id;

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.locked).toBe(true);
    expect(horse.body.lockReason).toContain('Fall during transport');
  });

  it('owner1 sees incidents for their horse; owner2 is forbidden', async () => {
    const mine = await api()
      .get(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBe(2);

    const notMine = await api()
      .get(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });

  it('GET /incidents/:id enforces ownership + 404', async () => {
    const ok = await api()
      .get(`/api/v1/incidents/${lowIncidentId}`)
      .set(auth('owner1'));
    expect(ok.status).toBe(200);

    const forbidden = await api()
      .get(`/api/v1/incidents/${lowIncidentId}`)
      .set(auth('owner2'));
    expect(forbidden.status).toBe(403);

    const missing = await api()
      .get('/api/v1/incidents/00000000-0000-0000-0000-000000000000')
      .set(auth('manager'));
    expect(missing.status).toBe(404);
  });

  it('VET moves the HIGH incident to IN_PROGRESS (200)', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'IN_PROGRESS' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('IN_PROGRESS');
  });

  it('rejects moving status backward (400)', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'OPEN' });
    expect(res.status).toBe(400);
  });

  it('GROOM/TRAINER cannot PATCH an incident (403)', async () => {
    for (const who of ['groom', 'trainer']) {
      const res = await api()
        .patch(`/api/v1/incidents/${highIncidentId}`)
        .set(auth(who))
        .send({ status: 'RESOLVED' });
      expect(res.status).toBe(403);
    }
  });

  it('rejects a healthRecordId for a different horse (400)', async () => {
    const otherRecord = await prisma.healthRecord.findFirst({
      where: { horseId: { not: horseId } },
    });
    expect(otherRecord).toBeTruthy();
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ healthRecordId: otherRecord!.id });
    expect(res.status).toBe(400);
  });

  const fitExam = async (diagnosis = 'Cleared after incident') =>
    (
      await api()
        .post(`/api/v1/horses/${horseId}/health-records`)
        .set(auth('vet'))
        .send({
          examDate: new Date().toISOString(),
          diagnosis,
          healthStatus: 'FIT',
        })
    ).body.id as string;

  it('closing an incident without a vet exam is refused (400)', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('VET resolves the HIGH incident with a FIT exam — auto-unlocks the horse (200)', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'RESOLVED', healthRecordId: await fitExam() });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.horseUnlocked).toBe(true);
    expect(res.body.healthRecord.healthStatus).toBe('FIT');

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.locked).toBe(false);
    expect(horse.body.lockReason).toBeNull();
  });

  it('PATCH on an already-RESOLVED incident is 400', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${highIncidentId}`)
      .set(auth('vet'))
      .send({ status: 'RESOLVED' });
    expect(res.status).toBe(400);
  });

  it('resolving the LOW incident (never locked) succeeds without error', async () => {
    const res = await api()
      .patch(`/api/v1/incidents/${lowIncidentId}`)
      .set(auth('vet'))
      .send({
        status: 'RESOLVED',
        healthRecordId: await fitExam('Routine check'),
      });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESOLVED');
    expect(res.body.horseUnlocked).toBe(false);
  });

  it('a HIGH incident on a horse locked for another reason does not take over that lock', async () => {
    const manual = await api()
      .patch(`/api/v1/horses/${horseId}/lock`)
      .set(auth('vet'))
      .send({ locked: true, reason: 'Manual rest week' });
    expect(manual.status).toBe(200);

    const high = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ description: 'Second fall', severity: 'HIGH' });
    expect(high.status).toBe(201);

    const resolved = await api()
      .patch(`/api/v1/incidents/${high.body.id}`)
      .set(auth('vet'))
      .send({
        status: 'RESOLVED',
        healthRecordId: await fitExam('After second fall'),
      });
    expect(resolved.status).toBe(200);
    expect(resolved.body.horseUnlocked).toBe(false);

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.locked).toBe(true);
    expect(horse.body.lockReason).toBe('Manual rest week');
  });

  it('GET /incidents filters by severity and puts HIGH first when sorted by severity', async () => {
    const high = await api()
      .get('/api/v1/incidents?severity=HIGH&limit=100')
      .set(auth('vet'));
    expect(high.status).toBe(200);
    expect(high.body.data.length).toBeGreaterThan(0);
    expect(
      high.body.data.every((i: { severity: string }) => i.severity === 'HIGH'),
    ).toBe(true);
    expect(high.body.counts.HIGH).toBeGreaterThan(0);

    const sorted = await api()
      .get('/api/v1/incidents?sort=severity&limit=100')
      .set(auth('vet'));
    const order = { HIGH: 0, MEDIUM: 1, LOW: 2 } as Record<string, number>;
    const ranks = sorted.body.data.map(
      (i: { severity: string }) => order[i.severity],
    );
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('GET /incidents paginates (limit/page/meta.total)', async () => {
    const page1 = await api()
      .get('/api/v1/incidents?limit=1&page=1')
      .set(auth('vet'));
    expect(page1.status).toBe(200);
    expect(page1.body.data).toHaveLength(1);
    expect(page1.body.meta.total).toBeGreaterThanOrEqual(2);
    const page2 = await api()
      .get('/api/v1/incidents?limit=1&page=2')
      .set(auth('vet'));
    expect(page2.body.data[0].id).not.toBe(page1.body.data[0].id);
  });

  it('an owner only sees incidents on their own horses in GET /incidents', async () => {
    const res = await api()
      .get('/api/v1/incidents?limit=100')
      .set(auth('owner2'));
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((i: { horseId: string }) => i.horseId !== horseId),
    ).toBe(true);
  });
});
