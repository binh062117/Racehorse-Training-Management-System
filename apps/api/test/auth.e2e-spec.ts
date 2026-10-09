import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AllExceptionsFilter } from './../src/common/filters/all-exceptions.filter';
import { PrismaService } from './../src/prisma/prisma.service';
import { MailService } from './../src/mail/mail.service';

const mockVerifyIdToken = jest.fn<
  Promise<{ getPayload: () => Record<string, unknown> }>,
  unknown[]
>();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: (...args: unknown[]) =>
      mockVerifyIdToken(...args) as unknown,
  })),
}));

/**
 * Full account lifecycle (docs/PLAN.md §6 Phase 1 + Phase 11 OTP/Google):
 * register -> verify OTP -> login blocked (PENDING) -> manager approves
 * -> login OK -> refresh (rotation) -> old refresh rejected -> logout.
 */
describe('Auth & Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const email = `e2e_${Date.now()}@racehorse.test`;
  const password = 'Secret123!';
  const mail = {
    otpCodes: [] as string[],
    resetTokens: [] as string[],
    approvedEmails: [] as string[],
    sendVerifyOtp: (_to: string, _name: string, code: string) => {
      mail.otpCodes.push(code);
      return Promise.resolve();
    },
    sendResetPassword: (_to: string, _name: string, token: string) => {
      mail.resetTokens.push(token);
      return Promise.resolve();
    },
    sendAccountApproved: (to: string) => {
      mail.approvedEmails.push(to);
      return Promise.resolve();
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mail)
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
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await prisma.user.deleteMany({ where: { email: googleEmail } });
    await app.close();
  });

  const api = () => request(app.getHttpServer());
  const googleEmail = `e2e_google_${Date.now()}@racehorse.test`;

  it('registers a PENDING user and sends an OTP', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'E2E User', email, password });
    expect(res.status).toBe(201);
    expect(mail.otpCodes).toHaveLength(1);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.status).toBe('PENDING');
    expect(user?.role).toBeNull();
  });

  it('rejects duplicate registration with CONFLICT', async () => {
    const res = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Dupe', email, password });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('blocks login before email verification', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_NOT_VERIFIED');
  });

  it('rejects the wrong OTP', async () => {
    const res = await api()
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('resend-otp always returns a generic message', async () => {
    const res = await api()
      .post('/api/v1/auth/resend-otp')
      .send({ email: 'unknown@racehorse.test' });
    expect(res.status).toBe(201);
  });

  it('verifies email with the newest emailed OTP', async () => {
    await api().post('/api/v1/auth/resend-otp').send({ email });
    expect(mail.otpCodes).toHaveLength(2);

    const res = await api()
      .post('/api/v1/auth/verify-otp')
      .send({ email, code: mail.otpCodes[mail.otpCodes.length - 1] });
    expect(res.status).toBe(201);
    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.emailVerifiedAt).not.toBeNull();
  });

  it('blocks login while still PENDING approval', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
  });

  it('lets a MANAGER approve the user (role + ACTIVE)', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    expect(login.status).toBe(201);
    const managerToken = login.body.accessToken as string;

    const target = await prisma.user.findUnique({ where: { email } });
    const res = await api()
      .patch(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'OWNER', status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('OWNER');
    expect(res.body.status).toBe('ACTIVE');
    expect(mail.approvedEmails).toContain(email);
  });

  it('does not re-send the approval email when re-activating a DISABLED user', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    const managerToken = login.body.accessToken as string;
    const target = await prisma.user.findUnique({ where: { email } });

    await api()
      .patch(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'DISABLED' });
    const before = mail.approvedEmails.length;

    const res = await api()
      .patch(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ status: 'ACTIVE' });
    expect(res.status).toBe(200);
    expect(mail.approvedEmails.length).toBe(before);
  });

  it('lets a MANAGER reject a PENDING registration, freeing the email', async () => {
    const rejectEmail = `e2e_reject_${Date.now()}@racehorse.test`;
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Reject Me', email: rejectEmail, password });

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    const managerToken = login.body.accessToken as string;

    const target = await prisma.user.findUnique({
      where: { email: rejectEmail },
    });
    const res = await api()
      .post(`/api/v1/users/${target!.id}/reject`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(201);

    const gone = await prisma.user.findUnique({
      where: { email: rejectEmail },
    });
    expect(gone).toBeNull();

    const reRegister = await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Reject Me Again', email: rejectEmail, password });
    expect(reRegister.status).toBe(201);
    await prisma.user.deleteMany({ where: { email: rejectEmail } });
  });

  it('cannot reject a non-PENDING user (CONFLICT)', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    const managerToken = login.body.accessToken as string;

    const target = await prisma.user.findUnique({ where: { email } });
    const res = await api()
      .post(`/api/v1/users/${target!.id}/reject`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('lets a MANAGER delete an approved (ACTIVE) user', async () => {
    const deleteEmail = `e2e_delete_${Date.now()}@racehorse.test`;
    await api()
      .post('/api/v1/auth/register')
      .send({ name: 'Delete Me', email: deleteEmail, password });
    const code = mail.otpCodes[mail.otpCodes.length - 1];
    await api()
      .post('/api/v1/auth/verify-otp')
      .send({ email: deleteEmail, code });

    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    const managerToken = login.body.accessToken as string;

    const target = await prisma.user.findUnique({
      where: { email: deleteEmail },
    });
    await api()
      .patch(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'OWNER', status: 'ACTIVE' });

    const res = await api()
      .delete(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(200);

    const deleted = await prisma.user.findUnique({
      where: { id: target!.id },
    });
    expect(deleted?.deletedAt).not.toBeNull();
    expect(deleted?.status).toBe('DISABLED');

    const list = await api()
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${managerToken}`);
    expect(
      (list.body.data as { id: string }[]).some((u) => u.id === target!.id),
    ).toBe(false);
  });

  it('a MANAGER cannot delete their own account (CONFLICT)', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    const managerToken = login.body.accessToken as string;
    const me = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${managerToken}`);

    const res = await api()
      .delete(`/api/v1/users/${me.body.id}`)
      .set('Authorization', `Bearer ${managerToken}`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('non-manager cannot delete a user (FORBIDDEN)', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    const target = await prisma.user.findUnique({ where: { email } });
    const res = await api()
      .delete(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('non-manager cannot list users (FORBIDDEN)', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    const res = await api()
      .get('/api/v1/users')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('logs in, refreshes (rotation), and rejects the reused token', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email, password });
    expect(login.status).toBe(201);
    const firstRefresh = login.body.refreshToken as string;

    const me = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.body.email).toBe(email);

    const rotated = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(rotated.status).toBe(201);
    expect(rotated.body.refreshToken).not.toBe(firstRefresh);

    const reused = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: firstRefresh });
    expect(reused.status).toBe(401);
    expect(reused.body.error.code).toBe('TOKEN_INVALID');

    const logout = await api()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(logout.status).toBe(201);

    const afterLogout = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: rotated.body.refreshToken });
    expect(afterLogout.status).toBe(401);
  });

  it('rejects an unverifiable Google idToken', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('bad token'));
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'bad' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  const googleSub = `google-${Date.now()}`;

  it('sends an OTP instead of tokens on first Google login', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: googleSub,
        email: googleEmail,
        email_verified: true,
        name: 'Google User',
      }),
    });
    const before = mail.otpCodes.length;
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'good' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ otpRequired: true, email: googleEmail });
    expect(mail.otpCodes.length).toBe(before + 1);

    const user = await prisma.user.findUnique({
      where: { email: googleEmail },
    });
    expect(user?.status).toBe('PENDING');
    expect(user?.googleId).toBe(googleSub);
    expect(user?.emailVerifiedAt).toBeNull();
  });

  it('still asks for OTP on a repeat Google click before it is verified', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: googleSub,
        email: googleEmail,
        email_verified: true,
        name: 'Google User',
      }),
    });
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'good' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ otpRequired: true, email: googleEmail });
  });

  it('ACCOUNT_PENDING after the Google OTP is verified but not yet approved', async () => {
    const verify = await api()
      .post('/api/v1/auth/verify-otp')
      .send({
        email: googleEmail,
        code: mail.otpCodes[mail.otpCodes.length - 1],
      });
    expect(verify.status).toBe(201);

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: googleSub,
        email: googleEmail,
        email_verified: true,
        name: 'Google User',
      }),
    });
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'good' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_PENDING');
  });

  it('lets an approved Google user log in and issues tokens', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    const managerToken = login.body.accessToken as string;
    const target = await prisma.user.findUnique({
      where: { email: googleEmail },
    });
    await api()
      .patch(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({ role: 'OWNER', status: 'ACTIVE' });

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: googleSub,
        email: googleEmail,
        email_verified: true,
        name: 'Google User',
      }),
    });
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'good' });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.user.email).toBe(googleEmail);
  });

  it('fails cleanly (not a 500) on a repeat Google login after the account was deleted', async () => {
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ email: 'manager@racehorse.local', password: 'Manager123!' });
    const managerToken = login.body.accessToken as string;
    const target = await prisma.user.findUnique({
      where: { email: googleEmail },
    });
    await api()
      .delete(`/api/v1/users/${target!.id}`)
      .set('Authorization', `Bearer ${managerToken}`);

    // email/googleId are unique across ALL rows (soft-deleted rows keep
    // them), so the fallback "no matching user -> create" branch in
    // googleLogin() used to crash on the DB unique constraint instead of
    // returning a clean error.
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        sub: googleSub,
        email: googleEmail,
        email_verified: true,
        name: 'Google User',
      }),
    });
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'good' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});
