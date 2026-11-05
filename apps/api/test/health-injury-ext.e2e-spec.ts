import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

// The incident-photo tests below exercise the local-disk fallback path and
// its per-owner access control (CloudinaryService.enabled === false bypasses
// that check entirely, by design — see horses.service.ts#toView for the
// same trade-off on horse photos). Force the fallback here regardless of
// what a developer's local .env has set. Set to '' rather than deleted:
// ConfigModule's dotenv load only fills in keys that are *absent* from
// process.env, so a deleted key would just get repopulated from .env when
// AppModule compiles below.
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';

/**
 * Phase 10 — Health & Injury extensions (Sprint 3 remainder). Covers UC-14
 * (healthStatus filter), UC-15 extension (healthStatus write), UC-16
 * (injury locations, both origins), UC-18 (vaccinations + upcoming),
 * UC-19 (incident photo upload), UC-20 (treatment plans + medications).
 * See docs/specs/phase-10-health-injury-extensions.md §9.
 */
describe('Health & Injury extensions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseId: string;
  let healthRecordId: string;
  let incidentId: string;
  let treatmentPlanId: string;

  const api = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  const login = async (email: string, password: string): Promise<string> => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  };

  const PNG_BYTES = Buffer.from(
    '89504e470d0a1a0a0000000d4948445200000001000000010802000000907753de0000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082',
    'hex',
  );

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

    const horse = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Health Ext Horse', ownerId: owner1Id });
    horseId = horse.body.id;

    const incident = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ description: 'E2E test incident', severity: 'LOW' });
    incidentId = incident.body.id;
  });

  it('UC-18: VET records deworming and filters the upcoming schedule by type', async () => {
    const create = await api()
      .post(`/api/v1/horses/${horseId}/vaccinations`)
      .set(auth('vet'))
      .send({
        careType: 'DEWORMING',
        vaccineName: 'Ivermectin',
        date: new Date(Date.now() - 86_400_000).toISOString(),
        nextDueDate: new Date(Date.now() + 8 * 86_400_000).toISOString(),
      });
    expect(create.status).toBe(201);
    expect(create.body.careType).toBe('DEWORMING');

    const list = await api()
      .get('/api/v1/vaccinations')
      .query({ upcoming: 'true', careType: 'DEWORMING', limit: 100 })
      .set(auth('manager'));
    expect(list.status).toBe(200);
    expect(
      list.body.data.some(
        (record: { horseId: string; careType: string; vaccineName: string }) =>
          record.horseId === horseId &&
          record.careType === 'DEWORMING' &&
          record.vaccineName === 'Ivermectin',
      ),
    ).toBe(true);
  });

  afterAll(async () => {
    await prisma.medication.deleteMany({ where: { healthRecordId } });
    await prisma.treatmentPlan.deleteMany({ where: { healthRecordId } });
    await prisma.injuryLocation.deleteMany({
      where: { OR: [{ incidentReportId: incidentId }, { healthRecordId }] },
    });
    await prisma.vaccination.deleteMany({ where: { horseId } });
    await prisma.incidentReport.deleteMany({ where: { horseId } });
    await prisma.healthRecord.deleteMany({ where: { horseId } });
    await prisma.notification.deleteMany({
      where: { message: { contains: 'E2E Health Ext Horse' } },
    });
    await prisma.horseLockEvent.deleteMany({ where: { horseId: horseId } });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    await app.close();
  });

  it('UC-15: VET creates a health record with healthStatus, which updates the horse', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/health-records`)
      .set(auth('vet'))
      .send({
        examDate: new Date(Date.now() - 86_400_000).toISOString(),
        diagnosis: 'Suspected soft tissue injury',
        healthStatus: 'INJURED',
      });
    expect(res.status).toBe(201);
    healthRecordId = res.body.id;

    const horse = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth('manager'));
    expect(horse.body.healthStatus).toBe('INJURED');
  });

  it('UC-14: GET /horses?healthStatus= filters by the new field', async () => {
    const injured = await api()
      .get('/api/v1/horses')
      .query({ healthStatus: 'INJURED', limit: 100 })
      .set(auth('manager'));
    expect(injured.status).toBe(200);
    expect(
      injured.body.data.some((h: { id: string }) => h.id === horseId),
    ).toBe(true);

    const fit = await api()
      .get('/api/v1/horses')
      .query({ healthStatus: 'FIT', limit: 100 })
      .set(auth('manager'));
    expect(fit.status).toBe(200);
    expect(fit.body.data.some((h: { id: string }) => h.id === horseId)).toBe(
      false,
    );
  });

  it('UC-16: VET creates an injury location from the incident (201)', async () => {
    const res = await api()
      .post(`/api/v1/incidents/${incidentId}/injury-locations`)
      .set(auth('vet'))
      .send({ bodyRegion: 'Left fore knee', side: 'left' });
    expect(res.status).toBe(201);
    expect(res.body.bodyRegion).toBe('Left fore knee');
  });

  it('UC-16: GROOM cannot create an injury location (403)', async () => {
    const res = await api()
      .post(`/api/v1/incidents/${incidentId}/injury-locations`)
      .set(auth('groom'))
      .send({ bodyRegion: 'Neck' });
    expect(res.status).toBe(403);
  });

  it('UC-16: VET creates an injury location from the health record (201)', async () => {
    const res = await api()
      .post(`/api/v1/health-records/${healthRecordId}/injury-locations`)
      .set(auth('vet'))
      .send({ bodyRegion: 'Back muscle' });
    expect(res.status).toBe(201);
  });

  it('UC-16: owner1 sees injury locations for their horse; owner2 is forbidden', async () => {
    const mine = await api()
      .get(`/api/v1/incidents/${incidentId}/injury-locations`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.length).toBeGreaterThan(0);

    const notMine = await api()
      .get(`/api/v1/incidents/${incidentId}/injury-locations`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });

  it('UC-18: VET creates a vaccination for the horse (201)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/vaccinations`)
      .set(auth('vet'))
      .send({
        vaccineName: 'Influenza',
        date: new Date(Date.now() - 86_400_000).toISOString(),
        nextDueDate: new Date(Date.now() + 10 * 86_400_000).toISOString(),
      });
    expect(res.status).toBe(201);
    expect(res.body.careType).toBe('VACCINATION');
  });

  it('UC-18: OWNER is forbidden from the club-wide vaccinations view (403)', async () => {
    const res = await api().get('/api/v1/vaccinations').set(auth('owner1'));
    expect(res.status).toBe(403);
  });

  it('UC-18: MANAGER sees the vaccination in the upcoming=true view', async () => {
    const res = await api()
      .get('/api/v1/vaccinations')
      .query({ upcoming: 'true', limit: 100 })
      .set(auth('manager'));
    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (v: {
          horseId: string;
          vaccineName: string;
          horse: { id: string; name: string };
        }) =>
          v.horseId === horseId &&
          v.vaccineName === 'Influenza' &&
          v.horse.id === horseId &&
          v.horse.name.length > 0,
      ),
    ).toBe(true);
  });

  it('UC-19: GROOM uploads an incident photo (201, photoUrl set)', async () => {
    const res = await api()
      .post(`/api/v1/incidents/${incidentId}/photo`)
      .set(auth('groom'))
      .attach('file', PNG_BYTES, 'incident.png');
    expect(res.status).toBe(201);
    expect(res.body.photoUrl).toMatch(/\/files\/incident-photos\//);
  });

  it('UC-19: the horse owner can open the incident photo (200)', async () => {
    const incident = await api()
      .get(`/api/v1/incidents/${incidentId}`)
      .set(auth('owner1'));
    const res = await api().get(incident.body.photoUrl).set(auth('owner1'));
    expect(res.status).toBe(200);
  });

  it('UC-19: a new photo replaces the old one, which stops being served', async () => {
    const before = await api()
      .get(`/api/v1/incidents/${incidentId}`)
      .set(auth('groom'));
    const res = await api()
      .post(`/api/v1/incidents/${incidentId}/photo`)
      .set(auth('groom'))
      .attach('file', PNG_BYTES, 'incident-2.png');
    expect(res.status).toBe(201);
    expect(res.body.photoUrl).not.toBe(before.body.photoUrl);
    const old = await api().get(before.body.photoUrl).set(auth('groom'));
    expect(old.status).toBe(404);
  });

  it('UC-19: only a GROOM can upload an incident photo (403 for TRAINER/VET)', async () => {
    for (const role of ['trainer', 'vet'] as const) {
      const res = await api()
        .post(`/api/v1/incidents/${incidentId}/photo`)
        .set(auth(role))
        .attach('file', PNG_BYTES, 'incident.png');
      expect(res.status).toBe(403);
    }
  });

  it('UC-19: rejects a request with no file (400)', async () => {
    const res = await api()
      .post(`/api/v1/incidents/${incidentId}/photo`)
      .set(auth('groom'));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('UC-19: rejects a file that is not a jpg/png/webp image (400)', async () => {
    const res = await api()
      .post(`/api/v1/incidents/${incidentId}/photo`)
      .set(auth('groom'))
      .attach('file', Buffer.from('not an image'), {
        filename: 'notes.txt',
        contentType: 'text/plain',
      });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('UC-19: photo upload on an unknown incident is 404', async () => {
    const res = await api()
      .post('/api/v1/incidents/00000000-0000-4000-8000-000000000000/photo')
      .set(auth('groom'))
      .attach('file', PNG_BYTES, 'incident.png');
    expect(res.status).toBe(404);
  });

  it('UC-19: another owner cannot fetch the incident photo (403)', async () => {
    const incident = await api()
      .get(`/api/v1/incidents/${incidentId}`)
      .set(auth('owner1'));
    const res = await api().get(incident.body.photoUrl).set(auth('owner2'));
    expect(res.status).toBe(403);
  });

  it('UC-20: VET creates a treatment plan for the health record (201)', async () => {
    const res = await api()
      .post(`/api/v1/health-records/${healthRecordId}/treatment-plans`)
      .set(auth('vet'))
      .send({
        description: 'Rest and monitor',
        startDate: new Date().toISOString(),
      });
    expect(res.status).toBe(201);
    treatmentPlanId = res.body.id;
  });

  it('UC-20: TRAINER cannot create a treatment plan (403)', async () => {
    const res = await api()
      .post(`/api/v1/health-records/${healthRecordId}/treatment-plans`)
      .set(auth('trainer'))
      .send({ description: 'nope', startDate: new Date().toISOString() });
    expect(res.status).toBe(403);
  });

  it('UC-20: VET creates a medication linked to the treatment plan (201)', async () => {
    const res = await api()
      .post(`/api/v1/treatment-plans/${treatmentPlanId}/medications`)
      .set(auth('vet'))
      .send({ name: 'Phenylbutazone', dosage: '2g PO' });
    expect(res.status).toBe(201);
    expect(res.body.treatmentPlanId).toBe(treatmentPlanId);
  });

  it('UC-20: owner1 lists medications for the plan; owner2 is forbidden', async () => {
    const mine = await api()
      .get(`/api/v1/treatment-plans/${treatmentPlanId}/medications`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.length).toBeGreaterThan(0);

    const notMine = await api()
      .get(`/api/v1/treatment-plans/${treatmentPlanId}/medications`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });
});
