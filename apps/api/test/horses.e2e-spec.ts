import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { existsSync, readdirSync, rmSync } from 'fs';
import { join } from 'path';

/**
 * Phase 2 — Horses. Covers CRUD, OWNER scoping / ownership 403s, and the
 * photo upload + permission-checked file serving. See docs/specs/phase-2-horses.md §9.
 * Assumes the Phase 2 seed has run (manager + owner1/owner2 + 3 horses).
 */
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

describe('Horses (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let managerToken: string;
  let owner1Token: string;
  let owner2Token: string;
  let owner1Id: string;
  let owner2Id: string;
  let managerId: string;
  let horseId: string;
  const createdHorseIds: string[] = [];

  const api = () => request(app.getHttpServer());

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

    managerToken = await login('manager@racehorse.local', 'Manager123!');
    owner1Token = await login('owner1@racehorse.local', 'Owner123!');
    owner2Token = await login('owner2@racehorse.local', 'Owner123!');
    managerId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'manager@racehorse.local' },
      })
    ).id;
    owner1Id = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner1@racehorse.local' },
      })
    ).id;
    owner2Id = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner2@racehorse.local' },
      })
    ).id;
  });

  afterAll(async () => {
    // Remove photo files created for the test horses.
    const dir = join(process.cwd(), 'uploads', 'horse-photos');
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (createdHorseIds.some((id) => f.startsWith(id))) {
          rmSync(join(dir, f), { force: true });
        }
      }
    }
    if (createdHorseIds.length) {
      await prisma.horse.deleteMany({ where: { id: { in: createdHorseIds } } });
    }
    await app.close();
  });

  const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

  it('MANAGER creates a horse (201)', async () => {
    const res = await api()
      .post('/api/v1/horses')
      .set(auth(managerToken))
      .send({ name: 'E2E Rocket', breed: 'Thoroughbred', ownerId: owner1Id });
    expect(res.status).toBe(201);
    expect(res.body.photoPath).toBeNull();
    expect(res.body.owner.id).toBe(owner1Id);
    horseId = res.body.id;
    createdHorseIds.push(horseId);
  });

  it('MANAGER creates a horse with gender and can update it (201/200)', async () => {
    const res = await api()
      .post('/api/v1/horses')
      .set(auth(managerToken))
      .send({ name: 'E2E Mare', gender: 'FEMALE', ownerId: owner1Id });
    expect(res.status).toBe(201);
    expect(res.body.gender).toBe('FEMALE');
    createdHorseIds.push(res.body.id as string);

    const patch = await api()
      .patch(`/api/v1/horses/${res.body.id}`)
      .set(auth(managerToken))
      .send({ gender: 'MALE' });
    expect(patch.status).toBe(200);
    expect(patch.body.gender).toBe('MALE');
  });

  it('rejects ownerId that is not an OWNER (400)', async () => {
    const res = await api()
      .post('/api/v1/horses')
      .set(auth(managerToken))
      .send({ name: 'Bad', ownerId: managerId });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a future birthDate (400)', async () => {
    const res = await api()
      .post('/api/v1/horses')
      .set(auth(managerToken))
      .send({ name: 'Future', ownerId: owner1Id, birthDate: '2999-01-01' });
    expect(res.status).toBe(400);
  });

  it('forbids a non-MANAGER from creating (403)', async () => {
    const res = await api()
      .post('/api/v1/horses')
      .set(auth(owner1Token))
      .send({ name: 'Nope', ownerId: owner1Id });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('OWNER list is scoped to their own horses', async () => {
    const res = await api().get('/api/v1/horses').set(auth(owner1Token));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
    expect(
      res.body.data.every((h: { ownerId: string }) => h.ownerId === owner1Id),
    ).toBe(true);
    expect(res.body.meta).toHaveProperty('total');
  });

  it('OWNER cannot widen scope via ownerId query', async () => {
    const res = await api()
      .get('/api/v1/horses')
      .query({ ownerId: owner2Id })
      .set(auth(owner1Token));
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((h: { ownerId: string }) => h.ownerId === owner1Id),
    ).toBe(true);
  });

  it("OWNER cannot read another owner's horse (403)", async () => {
    const res = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth(owner2Token));
    expect(res.status).toBe(403);
  });

  it('OWNER can read their own horse (200)', async () => {
    const res = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth(owner1Token));
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(horseId);
  });

  it('MANAGER updates status (200)', async () => {
    const res = await api()
      .patch(`/api/v1/horses/${horseId}`)
      .set(auth(managerToken))
      .send({ status: 'RESTING' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('RESTING');
  });

  describe('photo upload + serving', () => {
    let photoUrl: string;

    it('MANAGER uploads a photo (200)', async () => {
      const res = await api()
        .post(`/api/v1/horses/${horseId}/photo`)
        .set(auth(managerToken))
        .attach('file', PNG_1PX, 'rocket.png');
      expect(res.status).toBe(201);
      expect(res.body.photoPath).toMatch(/^horse-photos\//);
      expect(res.body.photoUrl).toBe(`/api/v1/files/${res.body.photoPath}`);
      photoUrl = res.body.photoUrl;
    });

    it('rejects a non-image upload (400)', async () => {
      const res = await api()
        .post(`/api/v1/horses/${horseId}/photo`)
        .set(auth(managerToken))
        .attach('file', Buffer.from('not an image'), 'x.txt');
      expect(res.status).toBe(400);
    });

    it('owner of the horse can fetch the photo (200)', async () => {
      const res = await api().get(photoUrl).set(auth(owner1Token));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
    });

    it('owner of the horse can fetch the photo via query token (200)', async () => {
      const res = await api().get(`${photoUrl}?token=${owner1Token}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('image/png');
    });

    it('another owner cannot fetch the photo (403)', async () => {
      const res = await api().get(photoUrl).set(auth(owner2Token));
      expect(res.status).toBe(403);
    });

    it('blocks a traversal-shaped filename (404)', async () => {
      const res = await api()
        .get('/api/v1/files/horse-photos/evil.exe')
        .set(auth(managerToken));
      expect(res.status).toBe(404);
    });
  });

  it('MANAGER soft-deletes the horse; subsequent GET is 404', async () => {
    const del = await api()
      .delete(`/api/v1/horses/${horseId}`)
      .set(auth(managerToken));
    expect(del.status).toBe(200);

    const res = await api()
      .get(`/api/v1/horses/${horseId}`)
      .set(auth(managerToken));
    expect(res.status).toBe(404);
  });

  it('GET unknown horse id is 404', async () => {
    const res = await api()
      .get('/api/v1/horses/00000000-0000-0000-0000-000000000000')
      .set(auth(managerToken));
    expect(res.status).toBe(404);
  });
});
