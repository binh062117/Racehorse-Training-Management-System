import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Phase 8 — Notifications. Covers list (own-only + unread filter) and
 * mark-read (ownership). Generates its own notification via a HIGH incident
 * so the suite doesn't depend on seed data timing. See
 * docs/specs/phase-8-health-injury.md §9.
 */
describe('Notifications (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let owner1Id: string;
  let horseId: string;
  let notificationId: string;

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
      .send({ name: 'E2E Notification Horse', ownerId: owner1Id });
    horseId = horse.body.id;

    // A HIGH incident fires both TRAINING_LOCKED and INCIDENT_REPORTED
    // notifications to the owner (and every MANAGER).
    const incident = await api()
      .post(`/api/v1/horses/${horseId}/incidents`)
      .set(auth('groom'))
      .send({ description: 'Notification trigger', severity: 'HIGH' });
    expect(incident.status).toBe(201);
  });

  afterAll(async () => {
    await prisma.incidentReport.deleteMany({ where: { horseId } });
    // Notifications reference no horseId — clean up by the message text they
    // all share (owner1's + every MANAGER's copy) instead.
    await prisma.notification.deleteMany({
      where: { message: { contains: 'E2E Notification Horse' } },
    });
    await prisma.horseLockEvent.deleteMany({ where: { horseId: horseId } });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    await app.close();
  });

  it('owner1 sees both notifications for the lock + incident (200)', async () => {
    const res = await api().get('/api/v1/notifications').set(auth('owner1'));
    expect(res.status).toBe(200);
    const types = res.body.data.map((n: { type: string }) => n.type);
    expect(types).toEqual(
      expect.arrayContaining(['TRAINING_LOCKED', 'INCIDENT_REPORTED']),
    );
    notificationId = res.body.data[0].id;
  });

  it('GET ?unread=true only returns unread notifications', async () => {
    const res = await api()
      .get('/api/v1/notifications')
      .query({ unread: 'true' })
      .set(auth('owner1'));
    expect(res.status).toBe(200);
    expect(
      res.body.data.every((n: { read: boolean }) => n.read === false),
    ).toBe(true);
  });

  it("owner2 does not see owner1's notifications", async () => {
    const res = await api().get('/api/v1/notifications').set(auth('owner2'));
    expect(res.status).toBe(200);
    expect(
      res.body.data.some((n: { id: string }) => n.id === notificationId),
    ).toBe(false);
  });

  it('owner1 marks a notification read (200)', async () => {
    const res = await api()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(auth('owner1'));
    expect(res.status).toBe(200);
    expect(res.body.read).toBe(true);
  });

  it("owner2 cannot mark owner1's notification read (403)", async () => {
    const res = await api()
      .patch(`/api/v1/notifications/${notificationId}/read`)
      .set(auth('owner2'));
    expect(res.status).toBe(403);
  });

  it('marking an unknown notification read is 404', async () => {
    const res = await api()
      .patch('/api/v1/notifications/00000000-0000-0000-0000-000000000000/read')
      .set(auth('owner1'));
    expect(res.status).toBe(404);
  });

  it('MANAGER also received the lock notification', async () => {
    const res = await api().get('/api/v1/notifications').set(auth('manager'));
    expect(res.status).toBe(200);
    expect(
      res.body.data.some(
        (n: { type: string; message: string }) =>
          n.type === 'TRAINING_LOCKED' &&
          n.message.includes('E2E Notification Horse'),
      ),
    ).toBe(true);
  });
});
