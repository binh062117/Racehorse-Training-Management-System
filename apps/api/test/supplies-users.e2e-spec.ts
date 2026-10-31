import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { MailService } from './../src/mail/mail.service';

/**
 * Supplies (stock + purchase requests, feed deducted from stock) and the
 * account screen's search / pending filter / bulk approval.
 */
describe('Supplies & account approval (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tokens: Record<string, string> = {};
  let horseId: string;
  let feedId: string;
  let requestId: string;
  const pendingIds: string[] = [];

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
    })
      // No real email on approval.
      .overrideProvider(MailService)
      .useValue({ sendAccountApproved: jest.fn(), sendOtp: jest.fn() })
      .compile();

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
    tokens.owner1 = await login('owner1@racehorse.local', 'Owner123!');

    const owner1 = await prisma.user.findUniqueOrThrow({
      where: { email: 'owner1@racehorse.local' },
    });
    const horse = await api()
      .post('/api/v1/horses')
      .set(auth('manager'))
      .send({ name: 'E2E Supply Horse', ownerId: owner1.id });
    horseId = horse.body.id;

    for (const n of [1, 2, 3]) {
      const u = await prisma.user.create({
        data: {
          name: `E2E Pending ${n}`,
          email: `e2e-pending-${n}@test.local`,
          status: 'PENDING',
        },
      });
      pendingIds.push(u.id);
    }
  });

  afterAll(async () => {
    await prisma.feedingRecord.deleteMany({ where: { horseId } });
    await prisma.supplyRequest.deleteMany({
      where: { item: { name: { startsWith: 'E2E ' } } },
    });
    await prisma.supplyItem.deleteMany({
      where: { name: { startsWith: 'E2E ' } },
    });
    await prisma.notification.deleteMany({
      where: { message: { contains: 'E2E Oats' } },
    });
    await prisma.horse.deleteMany({ where: { id: horseId } });
    await prisma.user.deleteMany({ where: { id: { in: pendingIds } } });
    await app.close();
  });

  // ---------- supplies ----------
  it('MANAGER adds a feed item to the store (201)', async () => {
    const res = await api().post('/api/v1/supplies').set(auth('manager')).send({
      name: 'E2E Oats',
      category: 'FEED',
      unit: 'kg',
      quantity: 10,
      minQuantity: 8,
    });
    expect(res.status).toBe(201);
    feedId = res.body.id;
  });

  it('GROOM cannot add store items (403)', async () => {
    const res = await api()
      .post('/api/v1/supplies')
      .set(auth('groom'))
      .send({ name: 'E2E Nope', category: 'FEED', unit: 'kg' });
    expect(res.status).toBe(403);
  });

  it('OWNER cannot see the store (403)', async () => {
    const res = await api().get('/api/v1/supplies').set(auth('owner1'));
    expect(res.status).toBe(403);
  });

  it('feeding from the store takes the quantity out of stock', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/feeding-records`)
      .set(auth('groom'))
      .send({
        feedType: 'E2E Oats',
        quantityKg: 4,
        date: new Date().toISOString(),
        supplyItemId: feedId,
      });
    expect(res.status).toBe(201);
    const list = await api()
      .get('/api/v1/supplies?low=true')
      .set(auth('groom'));
    const oats = list.body.find((i: { id: string }) => i.id === feedId);
    expect(oats.quantity).toBe(6);
    expect(oats.low).toBe(true);
  });

  it('feeding more than the stock holds is refused (400)', async () => {
    const res = await api()
      .post(`/api/v1/horses/${horseId}/feeding-records`)
      .set(auth('groom'))
      .send({
        feedType: 'E2E Oats',
        quantityKg: 50,
        date: new Date().toISOString(),
        supplyItemId: feedId,
      });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain('không đủ');
  });

  it('GROOM asks to buy more; managers are notified (201)', async () => {
    const res = await api()
      .post('/api/v1/supply-requests')
      .set(auth('groom'))
      .send({ itemId: feedId, quantity: 20, note: 'Sắp hết' });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('PENDING');
    requestId = res.body.id;
    const manager = await prisma.user.findUniqueOrThrow({
      where: { email: 'manager@racehorse.local' },
    });
    const note = await prisma.notification.findFirst({
      where: {
        userId: manager.id,
        type: 'SUPPLY_REQUESTED',
        message: { contains: 'E2E Oats' },
      },
    });
    expect(note).toBeTruthy();
  });

  it('GROOM cannot approve a request (403)', async () => {
    const res = await api()
      .patch(`/api/v1/supply-requests/${requestId}`)
      .set(auth('groom'))
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(403);
  });

  it('MANAGER approves: stock goes up by the requested amount (200)', async () => {
    const res = await api()
      .patch(`/api/v1/supply-requests/${requestId}`)
      .set(auth('manager'))
      .send({ status: 'APPROVED' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');
    const item = await prisma.supplyItem.findUniqueOrThrow({
      where: { id: feedId },
    });
    expect(item.quantity).toBe(26);
  });

  it('a request can only be decided once (400)', async () => {
    const res = await api()
      .patch(`/api/v1/supply-requests/${requestId}`)
      .set(auth('manager'))
      .send({ status: 'REJECTED' });
    expect(res.status).toBe(400);
  });

  it('a rejected request leaves stock unchanged', async () => {
    const req = await api()
      .post('/api/v1/supply-requests')
      .set(auth('groom'))
      .send({ itemId: feedId, quantity: 5 });
    const res = await api()
      .patch(`/api/v1/supply-requests/${req.body.id}`)
      .set(auth('manager'))
      .send({ status: 'REJECTED', note: 'Đủ dùng' });
    expect(res.status).toBe(200);
    const item = await prisma.supplyItem.findUniqueOrThrow({
      where: { id: feedId },
    });
    expect(item.quantity).toBe(26);
  });

  // ---------- accounts ----------
  it('GET /users searches by name or email and reports counts per status', async () => {
    const res = await api()
      .get('/api/v1/users?q=e2e-pending&limit=100')
      .set(auth('manager'));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(3);
    expect(res.body.counts.PENDING).toBe(3);
  });

  it('GET /users?status=PENDING pages through pending accounts', async () => {
    const page = await api()
      .get('/api/v1/users?q=E2E Pending&status=PENDING&limit=2&page=2')
      .set(auth('manager'));
    expect(page.body.meta.total).toBe(3);
    expect(page.body.data).toHaveLength(1);
  });

  it('MANAGER approves several pending accounts at once, each with its role (201)', async () => {
    const res = await api()
      .post('/api/v1/users/approve')
      .set(auth('manager'))
      .send({
        users: [
          { id: pendingIds[0], role: 'GROOM' },
          { id: pendingIds[1], role: 'OWNER' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.approved).toHaveLength(2);
    const [a, b] = await Promise.all(
      pendingIds
        .slice(0, 2)
        .map((id) => prisma.user.findUniqueOrThrow({ where: { id } })),
    );
    expect(a.status).toBe('ACTIVE');
    expect(a.role).toBe('GROOM');
    expect(b.role).toBe('OWNER');
  });

  it('accounts that are no longer pending are skipped, not failed', async () => {
    const res = await api()
      .post('/api/v1/users/approve')
      .set(auth('manager'))
      .send({
        users: [
          { id: pendingIds[0], role: 'VET' },
          { id: pendingIds[2], role: 'VET' },
        ],
      });
    expect(res.status).toBe(201);
    expect(res.body.skipped).toEqual([pendingIds[0]]);
    const first = await prisma.user.findUniqueOrThrow({
      where: { id: pendingIds[0] },
    });
    expect(first.role).toBe('GROOM');
  });

  it('only a MANAGER can bulk-approve (403)', async () => {
    const res = await api()
      .post('/api/v1/users/approve')
      .set(auth('vet'))
      .send({ users: [{ id: pendingIds[2], role: 'VET' }] });
    expect(res.status).toBe(403);
  });
});
