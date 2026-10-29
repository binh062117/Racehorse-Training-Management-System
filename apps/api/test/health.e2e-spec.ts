import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { join } from 'path';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

// The attachment-serving tests below exercise the local-disk fallback path
// and its per-owner access control (CloudinaryService.enabled === false
// bypasses that check entirely, by design — see horses.service.ts#toView
// for the same trade-off on horse photos). Force the fallback here
// regardless of what a developer's local .env has set, so this suite
// doesn't flip behavior — or hit real Cloudinary — just because
// CLOUDINARY_* happens to be configured for manual testing. Set to '' rather
// than deleted: ConfigModule's dotenv load only fills in keys that are
// *absent* from process.env, so a deleted key would just get repopulated
// from .env when AppModule compiles below.
process.env.CLOUDINARY_CLOUD_NAME = '';
process.env.CLOUDINARY_API_KEY = '';
process.env.CLOUDINARY_API_SECRET = '';

/**
 * Phase 4 — Health records. Covers create (VET), horse-scoped listing +
 * ownership, record detail ownership, PATCH (VET only), the future-examDate
 * rule, and permission-checked attachment upload/serving.
 * See docs/specs/phase-4-health.md §9. Assumes the Phase 3/4 seed has run.
 */
const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n1 0 obj<< /Type /Catalog >>endobj\ntrailer<< /Root 1 0 R >>\n%%EOF',
);

describe('Health records (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseId: string;
  const recordIds: string[] = [];

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
      .send({ name: 'E2E Patient', ownerId: owner1Id });
    horseId = horse.body.id;
  });

  afterAll(async () => {
    await prisma.healthRecord.deleteMany({ where: { horseId } });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    // Remove attachment files created for the test record.
    const dir = join(process.cwd(), 'uploads', 'health-attachments');
    if (existsSync(dir)) {
      for (const f of readdirSync(dir)) {
        if (recordIds.some((id) => f.startsWith(id))) {
          unlinkSync(join(dir, f));
        }
      }
    }
    await app.close();
  });

  const create = (who: string, body: Record<string, unknown>) =>
    api()
      .post(`/api/v1/horses/${horseId}/health-records`)
      .set(auth(who))
      .send(body);

  it('VET creates a record (201)', async () => {
    const res = await create('vet', {
      examDate: new Date(Date.now() - 86_400_000).toISOString(),
      diagnosis: 'Sound, no issues',
    });
    expect(res.status).toBe(201);
    expect(res.body.vet.email).toBe('vet@racehorse.local');
    expect(res.body.horseId).toBe(horseId);
    expect(res.body.attachmentUrl).toBeNull();
    recordIds.push(res.body.id);
  });

  it('rejects a record without diagnosis (400)', async () => {
    const res = await create('vet', {
      examDate: new Date().toISOString(),
    });
    expect(res.status).toBe(400);
  });

  it('rejects a future examDate (400)', async () => {
    const res = await create('vet', {
      examDate: new Date(Date.now() + 86_400_000).toISOString(),
      diagnosis: 'time traveller',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('TRAINER cannot create a record (403)', async () => {
    const res = await create('trainer', {
      examDate: new Date().toISOString(),
      diagnosis: 'x',
    });
    expect(res.status).toBe(403);
  });

  it('OWNER cannot create a record (403)', async () => {
    const res = await create('owner1', {
      examDate: new Date().toISOString(),
      diagnosis: 'x',
    });
    expect(res.status).toBe(403);
  });

  it('creating on an unknown horse is 404', async () => {
    const res = await api()
      .post(
        '/api/v1/horses/00000000-0000-0000-0000-000000000000/health-records',
      )
      .set(auth('vet'))
      .send({ examDate: new Date().toISOString(), diagnosis: 'x' });
    expect(res.status).toBe(404);
  });

  it('owner sees records for their own horse; another owner gets 403', async () => {
    const mine = await api()
      .get(`/api/v1/horses/${horseId}/health-records`)
      .set(auth('owner1'));
    expect(mine.status).toBe(200);
    expect(mine.body.data.length).toBeGreaterThan(0);

    const notMine = await api()
      .get(`/api/v1/horses/${horseId}/health-records`)
      .set(auth('owner2'));
    expect(notMine.status).toBe(403);
  });

  it('GET /health-records/:id enforces ownership', async () => {
    const ok = await api()
      .get(`/api/v1/health-records/${recordIds[0]}`)
      .set(auth('owner1'));
    expect(ok.status).toBe(200);

    const forbidden = await api()
      .get(`/api/v1/health-records/${recordIds[0]}`)
      .set(auth('owner2'));
    expect(forbidden.status).toBe(403);

    const missing = await api()
      .get('/api/v1/health-records/00000000-0000-0000-0000-000000000000')
      .set(auth('manager'));
    expect(missing.status).toBe(404);
  });

  it('VET edits treatment (200)', async () => {
    const res = await api()
      .patch(`/api/v1/health-records/${recordIds[0]}`)
      .set(auth('vet'))
      .send({ treatment: 'Rest 3 days' });
    expect(res.status).toBe(200);
    expect(res.body.treatment).toBe('Rest 3 days');
  });

  it('TRAINER cannot edit a record (403)', async () => {
    const res = await api()
      .patch(`/api/v1/health-records/${recordIds[0]}`)
      .set(auth('trainer'))
      .send({ treatment: 'nope' });
    expect(res.status).toBe(403);
  });

  describe('attachment upload + serving', () => {
    let attachmentUrl: string;

    it('VET uploads a PDF attachment (201)', async () => {
      const res = await api()
        .post(`/api/v1/health-records/${recordIds[0]}/attachment`)
        .set(auth('vet'))
        .attach('file', PDF_BYTES, 'labresult.pdf');
      expect(res.status).toBe(201);
      expect(res.body.attachmentPath).toMatch(/^health-attachments\//);
      expect(res.body.attachmentUrl).toBe(
        `/api/v1/files/${res.body.attachmentPath}`,
      );
      attachmentUrl = res.body.attachmentUrl;
    });

    it('rejects a non-allowed file type (400)', async () => {
      const res = await api()
        .post(`/api/v1/health-records/${recordIds[0]}/attachment`)
        .set(auth('vet'))
        .attach('file', Buffer.from('plain text'), 'notes.txt');
      expect(res.status).toBe(400);
    });

    it('owner of the horse can fetch the attachment (200)', async () => {
      const res = await api().get(attachmentUrl).set(auth('owner1'));
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
    });

    it('another owner cannot fetch the attachment (403)', async () => {
      const res = await api().get(attachmentUrl).set(auth('owner2'));
      expect(res.status).toBe(403);
    });

    it('blocks a traversal-shaped filename (404)', async () => {
      const res = await api()
        .get('/api/v1/files/health-attachments/evil.exe')
        .set(auth('manager'));
      expect(res.status).toBe(404);
    });
  });

  it('filters the list by date range', async () => {
    const res = await api()
      .get(`/api/v1/horses/${horseId}/health-records`)
      .query({ from: new Date(Date.now() - 172_800_000).toISOString() })
      .set(auth('vet'));
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});
