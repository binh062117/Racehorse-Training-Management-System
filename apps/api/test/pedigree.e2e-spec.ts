import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 6 — Pedigree. Covers PATCH /horses/:id sireId/damId/fitnessScore
 * validation and GET /horses/:id/pedigree (3-generation tree + ownership).
 * See docs/specs/phase-6-pedigree.md §9.
 */
describe('Pedigree (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  const horseIds: string[] = [];
  let childId: string;
  let sireId: string;
  let damId: string;
  let grandsireId: string;

  const api = () => request(app.getHttpServer());
  const auth = (who: string) => ({ Authorization: `Bearer ${tokens[who]}` });

  const login = async (email: string, password: string): Promise<string> => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(201);
    return res.body.accessToken as string;
  };

  const createHorse = async (
    name: string,
    ownerId: string,
  ): Promise<string> => {
    const res = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name, ownerId });
    expect(res.status).toBe(201);
    horseIds.push(res.body.id as string);
    return res.body.id as string;
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
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');
    tokens.owner2 = await login('owner2@racehorse.local', 'Owner123!');

    owner1Id = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner1@racehorse.local' },
      })
    ).id;

    grandsireId = await createHorse('E2E Grandsire', owner1Id);
    sireId = await createHorse('E2E Sire', owner1Id);
    damId = await createHorse('E2E Dam', owner1Id);
    childId = await createHorse('E2E Child', owner1Id);

    await api()
      .patch(`/api/v1/horses/${sireId}`)
      .set(auth('manager'))
      .send({ sireId: grandsireId });
  });

  afterAll(async () => {
    await prisma.horseLockEvent.deleteMany({
      where: { horseId: { in: horseIds } },
    });
    await prisma.horse.deleteMany({ where: { id: { in: horseIds } } });
    await app.close();
  });

  it('MANAGER sets sireId + damId + fitnessScore (200)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${childId}`)
      .set(auth('manager'))
      .send({ sireId, damId, fitnessScore: 80 });
    expect(res.status).toBe(200);
    expect(res.body.sireId).toBe(sireId);
    expect(res.body.damId).toBe(damId);
    expect(res.body.fitnessScore).toBe(80);
  });

  it('rejects sireId pointing at itself (400)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${childId}`)
      .set(auth('manager'))
      .send({ sireId: childId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects sireId === damId (400)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${childId}`)
      .set(auth('manager'))
      .send({ sireId, damId: sireId });
    expect(res.status).toBe(400);
  });

  it('rejects sireId referencing an unknown horse (400)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${childId}`)
      .set(auth('manager'))
      .send({ sireId: '00000000-0000-0000-0000-000000000000' });
    expect(res.status).toBe(400);
  });

  it('rejects fitnessScore out of range (400)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${childId}`)
      .set(auth('manager'))
      .send({ fitnessScore: 150 });
    expect(res.status).toBe(400);
  });

  it('TRAINER cannot PATCH a horse (403)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${childId}`)
      .set(auth('trainer'))
      .send({ fitnessScore: 10 });
    expect(res.status).toBe(403);
  });

  it('owner sees the pedigree tree for their own horse (200)', async () => {
    const res = await api()
      .get(`/api/v1/horses/${childId}/pedigree`)
      .set(auth('owner1'));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(childId);
    expect(res.body.sire.id).toBe(sireId);
    expect(res.body.dam.id).toBe(damId);
    // 3rd generation: sire's own sire (grandsire) resolved.
    expect(res.body.sire.sire.id).toBe(grandsireId);
    // grandsire is generation 3 — its own parents are capped, not fetched.
    expect(res.body.sire.sire.sire).toBeNull();
    expect(res.body.dam.sire).toBeNull();
  });

  it('another owner cannot see the pedigree (403)', async () => {
    const res = await api()
      .get(`/api/v1/horses/${childId}/pedigree`)
      .set(auth('owner2'));
    expect(res.status).toBe(403);
  });

  it('pedigree of an unknown horse is 404', async () => {
    const res = await api()
      .get('/api/v1/horses/00000000-0000-0000-0000-000000000000/pedigree')
      .set(auth('manager'));
    expect(res.status).toBe(404);
  });
});
