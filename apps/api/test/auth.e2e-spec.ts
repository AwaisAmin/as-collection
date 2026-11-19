import { randomInt, randomUUID } from 'node:crypto';

import type { NestNodeApplication } from '@nestjs/platform-node';
import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';
import request from 'supertest';

import { PrismaService } from '../src/database/prisma.service.js';
import { GOOGLE_JWKS } from '../src/modules/auth/google-id-token.verifier.js';
import { RedisThrottlerStorage } from '../src/redis/redis-throttler.storage.js';
import { createTestApp } from './helpers/create-test-app.js';

/*
 * Runs against the migrated database and Redis. Test data uses the unassigned +92 399 range and
 * `e2e-` Google ids, and is deleted before and after the run (also resets the per-IP OTP limit).
 */
const TEST_PHONE_PREFIX = '+92399';
const GOOGLE_CLIENT_ID = 'e2e-client.apps.googleusercontent.com';

const newPhone = () => `${TEST_PHONE_PREFIX}${String(randomInt(0, 10_000_000)).padStart(7, '0')}`;
/** The local spelling customers type; the API normalizes it to E.164. */
const local = (e164: string) => `0${e164.slice(3, 6)}-${e164.slice(6)}`;

interface LoginBody {
  token: string;
  expiresAt: string;
  isNew: boolean;
  customer: { id: string; phone: string | null; email: string | null; googleLinked: boolean };
}

describe('customer auth & account (e2e)', () => {
  let app: NestNodeApplication;
  let prisma: PrismaService;
  let signGoogle: (claims: Record<string, unknown>) => Promise<string>;

  const http = () => request(app.getHttpServer());
  const api = (path: string) => `/api/v1${path}`;
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });

  async function requestCode(phone: string): Promise<string> {
    const res = await http()
      .post(api('/auth/otp'))
      .send({ phone: local(phone) })
      .expect(202);
    return (res.body as { devCode: string }).devCode;
  }

  async function login(phone = newPhone()): Promise<LoginBody & { phone: string }> {
    const code = await requestCode(phone);
    const res = await http().post(api('/auth/otp/verify')).send({ phone, code }).expect(200);
    return { ...(res.body as LoginBody), phone };
  }

  async function cleanup() {
    const where = {
      OR: [{ phone: { startsWith: TEST_PHONE_PREFIX } }, { googleSub: { startsWith: 'e2e-' } }],
    };
    await prisma.order.deleteMany({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
    await prisma.customer.deleteMany({ where });
    await prisma.otpChallenge.deleteMany({ where: { phone: { startsWith: TEST_PHONE_PREFIX } } });
  }

  beforeAll(async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');
    const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'e2e', alg: 'RS256' };
    signGoogle = (claims) =>
      new SignJWT(claims)
        .setProtectedHeader({ alg: 'RS256', kid: 'e2e' })
        .setIssuer('https://accounts.google.com')
        .setAudience(GOOGLE_CLIENT_ID)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);

    ({ app } = await createTestApp(
      {
        RATE_LIMIT_MAX: '1000',
        AUTH_RATE_LIMIT_MAX: '1000',
        OTP_DEV_ECHO: 'true',
        GOOGLE_CLIENT_IDS: GOOGLE_CLIENT_ID,
      },
      (builder) =>
        builder.overrideProvider(GOOGLE_JWKS).useValue(createLocalJWKSet({ keys: [jwk] })),
    ));
    prisma = app.get(PrismaService);
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  describe('phone OTP', () => {
    it('sends a code, then enforces the resend cooldown with Retry-After', async () => {
      const phone = newPhone();
      const first = await http()
        .post(api('/auth/otp'))
        .send({ phone: local(phone) })
        .expect(202);
      expect(first.headers['cache-control']).toBe('no-store');
      expect(first.body).toMatchObject({
        channel: 'SMS',
        expiresInSeconds: 300,
        resendInSeconds: 30,
        devCode: expect.stringMatching(/^\d{6}$/),
      });

      const again = await http().post(api('/auth/otp')).send({ phone }).expect(429);
      expect(again.body).toMatchObject({ code: 'OTP_RATE_LIMITED' });
      expect(Number(again.headers['retry-after'])).toBeGreaterThan(0);

      // Only a hash is stored, never the code.
      const stored = await prisma.otpChallenge.findFirstOrThrow({ where: { phone } });
      expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
      expect(stored.codeHash).not.toContain((first.body as { devCode: string }).devCode);
      expect(stored.ipHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('serializes parallel requests for one phone: exactly one code is sent', async () => {
      const phone = newPhone();
      const results = await Promise.all(
        Array.from({ length: 5 }, () => http().post(api('/auth/otp')).send({ phone })),
      );
      expect(results.map((r) => r.status).sort()).toEqual([202, 429, 429, 429, 429]);
      expect(await prisma.otpChallenge.count({ where: { phone } })).toBe(1);
    });

    it('rejects numbers that are not Pakistani mobiles', async () => {
      const res = await http().post(api('/auth/otp')).send({ phone: '042-1234567' }).expect(422);
      expect(res.body.errors[0].path).toBe('phone');
      await http().post(api('/auth/otp')).send({ phone: newPhone(), extra: 1 }).expect(422);
    });

    it('signs in with the right code (once) and creates the account', async () => {
      const phone = newPhone();
      const code = await requestCode(phone);
      const wrong = code === '000000' ? '111111' : '000000';

      const bad = await http().post(api('/auth/otp/verify')).send({ phone, code: wrong });
      expect(bad.status).toBe(400);
      expect(bad.body).toMatchObject({ code: 'OTP_INVALID', attemptsLeft: 4 });

      const ok = await http().post(api('/auth/otp/verify')).send({ phone, code }).expect(200);
      const body = ok.body as LoginBody;
      expect(body).toMatchObject({ isNew: true, customer: { phone, googleLinked: false } });
      expect(body.token).toMatch(/^[\w-]{43}$/);

      const reused = await http().post(api('/auth/otp/verify')).send({ phone, code });
      expect(reused.body.code).toBe('OTP_NOT_REQUESTED');

      // Session tokens are stored hashed too.
      const session = await prisma.customerSession.findFirstOrThrow({
        where: { customerId: body.customer.id },
      });
      expect(session.tokenHash).not.toBe(body.token);
    });

    it('locks the code after five wrong guesses', async () => {
      const phone = newPhone();
      const code = await requestCode(phone);
      const wrong = code === '000000' ? '111111' : '000000';
      for (let left = 4; left >= 1; left--) {
        const res = await http().post(api('/auth/otp/verify')).send({ phone, code: wrong });
        expect(res.body).toMatchObject({ code: 'OTP_INVALID', attemptsLeft: left });
      }
      const last = await http().post(api('/auth/otp/verify')).send({ phone, code: wrong });
      expect(last.body.code).toBe('OTP_TOO_MANY_ATTEMPTS');
      const correct = await http().post(api('/auth/otp/verify')).send({ phone, code });
      expect(correct.body.code).toBe('OTP_NOT_REQUESTED');
    });

    it('rejects expired codes', async () => {
      const phone = newPhone();
      const code = await requestCode(phone);
      await prisma.otpChallenge.updateMany({
        where: { phone },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      const res = await http().post(api('/auth/otp/verify')).send({ phone, code }).expect(400);
      expect(res.body.code).toBe('OTP_EXPIRED');
    });

    it('links earlier guest orders and recognizes returning customers', async () => {
      const phone = newPhone();
      const order = await prisma.order.create({
        data: {
          number: `E2E-${randomUUID().slice(0, 8)}`,
          accessKeyHash: 'a'.repeat(64),
          paymentMethod: 'COD',
          customerName: 'Guest',
          phone,
          shippingName: 'Guest',
          shippingPhone: phone,
          shippingLine1: 'House 1, Street 2',
          shippingCity: 'Lahore',
          subtotalMinor: 100_000,
          shippingMinor: 25_000,
          totalMinor: 125_000,
          idempotencyKey: randomUUID(),
        },
      });
      const first = await login(phone);
      expect(first.isNew).toBe(true);
      const linked = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
      expect(linked.customerId).toBe(first.customer.id);

      // Next login (after the cooldown) is the same account.
      await prisma.otpChallenge.updateMany({
        where: { phone },
        data: { createdAt: new Date(Date.now() - 60_000) },
      });
      const second = await login(phone);
      expect(second).toMatchObject({ isNew: false, customer: { id: first.customer.id } });
    });

    it('refuses blocked customers', async () => {
      const { phone, customer } = await login();
      await prisma.customer.update({ where: { id: customer.id }, data: { status: 'BLOCKED' } });
      await prisma.otpChallenge.updateMany({
        where: { phone },
        data: { createdAt: new Date(Date.now() - 60_000) },
      });
      const code = await requestCode(phone);
      const res = await http().post(api('/auth/otp/verify')).send({ phone, code }).expect(403);
      expect(res.body.code).toBe('ACCOUNT_BLOCKED');
    });
  });

  describe('rate limiting', () => {
    it('counts hits in Redis and blocks past the limit', async () => {
      const storage = app.get(RedisThrottlerStorage);
      const key = `e2e-${randomUUID()}`;
      const hit = () => storage.increment(key, 60_000, 2, 0, 'e2e');
      expect(await hit()).toMatchObject({ totalHits: 1, isBlocked: false });
      expect(await hit()).toMatchObject({ totalHits: 2, isBlocked: false });
      const blocked = await hit();
      expect(blocked).toMatchObject({ totalHits: 3, isBlocked: true });
      expect(blocked.timeToBlockExpire).toBeGreaterThan(0);
    });
  });

  describe('sessions', () => {
    it('requires a valid bearer token', async () => {
      const missing = await http().get(api('/auth/session')).expect(401);
      expect(missing.body.code).toBe('UNAUTHENTICATED');
      expect(missing.headers['www-authenticate']).toBe('Bearer');
      await http().get(api('/auth/session')).set(bearer('garbage')).expect(401);
      await http()
        .get(api('/auth/session'))
        .set(bearer('A'.repeat(43)))
        .expect(401);
    });

    it('returns the session, lists devices, revokes others and logs out', async () => {
      const first = await login();
      await prisma.otpChallenge.updateMany({
        where: { phone: first.phone },
        data: { createdAt: new Date(Date.now() - 60_000) },
      });
      const second = await login(first.phone);

      const me = await http().get(api('/auth/session')).set(bearer(second.token)).expect(200);
      expect(me.body.customer.id).toBe(first.customer.id);

      const devices = await http().get(api('/account/sessions')).set(bearer(second.token));
      expect(devices.body).toHaveLength(2);
      expect(devices.body.filter((d: { current: boolean }) => d.current)).toHaveLength(1);

      const revoked = await http()
        .post(api('/account/sessions/revoke-others'))
        .set(bearer(second.token))
        .expect(200);
      expect(revoked.body).toEqual({ revoked: 1 });
      await http().get(api('/auth/session')).set(bearer(first.token)).expect(401);

      await http().post(api('/auth/logout')).set(bearer(second.token)).expect(204);
      await http().get(api('/auth/session')).set(bearer(second.token)).expect(401);
    });
  });

  describe('Google sign-in', () => {
    it('creates an account, then signs the same Google user back in', async () => {
      const sub = `e2e-${randomUUID()}`;
      const idToken = await signGoogle({
        sub,
        email: `${sub}@example.com`,
        email_verified: true,
        name: 'Sana Khan',
      });
      const first = await http().post(api('/auth/google')).send({ idToken }).expect(200);
      expect(first.body).toMatchObject({
        isNew: true,
        customer: { googleLinked: true, email: `${sub}@example.com`, emailVerified: true },
      });
      const again = await http().post(api('/auth/google')).send({ idToken }).expect(200);
      expect(again.body).toMatchObject({ isNew: false, customer: { id: first.body.customer.id } });
    });

    it('rejects tokens for another audience', async () => {
      const token = await new SignJWT({ sub: 'e2e-x' })
        .setProtectedHeader({ alg: 'RS256', kid: 'e2e' })
        .setIssuer('https://accounts.google.com')
        .setAudience('someone-else')
        .setExpirationTime('5m')
        .sign((await generateKeyPair('RS256')).privateKey);
      const res = await http().post(api('/auth/google')).send({ idToken: token }).expect(401);
      expect(res.body.code).toBe('GOOGLE_TOKEN_INVALID');
    });

    it('never links to an account whose email was only typed in (pre-hijack protection)', async () => {
      const phoneUser = await login();
      const email = `victim-${randomUUID()}@example.com`;
      await http().patch(api('/account')).set(bearer(phoneUser.token)).send({ email }).expect(200);

      const sub = `e2e-${randomUUID()}`;
      const idToken = await signGoogle({ sub, email, email_verified: true });
      const google = await http().post(api('/auth/google')).send({ idToken }).expect(200);
      expect(google.body.isNew).toBe(true);
      expect(google.body.customer.id).not.toBe(phoneUser.customer.id);
      expect(google.body.customer).toMatchObject({ email, emailVerified: true });

      const attacker = await http().get(api('/account')).set(bearer(phoneUser.token));
      expect(attacker.body.email).toBeNull();
    });

    it('lets a Google account add a verified phone, but not one owned by someone else', async () => {
      const sub = `e2e-${randomUUID()}`;
      const google = await http()
        .post(api('/auth/google'))
        .send({ idToken: await signGoogle({ sub }) })
        .expect(200);
      const token = (google.body as LoginBody).token;
      expect(google.body.customer.phone).toBeNull();

      const phone = newPhone();
      const code = await requestCode(phone);
      const added = await http()
        .post(api('/account/phone'))
        .set(bearer(token))
        .send({ phone, code })
        .expect(200);
      expect(added.body.phone).toBe(phone);

      const other = await login();
      await prisma.otpChallenge.updateMany({
        where: { phone: other.phone },
        data: { createdAt: new Date(Date.now() - 60_000) },
      });
      const otherCode = await requestCode(other.phone);
      const taken = await http()
        .post(api('/account/phone'))
        .set(bearer(token))
        .send({ phone: other.phone, code: otherCode })
        .expect(409);
      expect(taken.body.code).toBe('PHONE_IN_USE');
    });
  });

  describe('profile & address book', () => {
    it('updates the profile and rejects duplicate emails and empty updates', async () => {
      const a = await login();
      const b = await login();
      const email = `p-${randomUUID()}@example.com`;
      const updated = await http()
        .patch(api('/account'))
        .set(bearer(a.token))
        .send({ name: '  Ayesha   Malik ', email: email.toUpperCase(), marketingOptIn: true })
        .expect(200);
      expect(updated.body).toMatchObject({
        name: 'Ayesha Malik',
        email,
        emailVerified: false,
        marketingOptIn: true,
      });
      const dup = await http()
        .patch(api('/account'))
        .set(bearer(b.token))
        .send({ email })
        .expect(409);
      expect(dup.body.code).toBe('EMAIL_IN_USE');
      await http().patch(api('/account')).set(bearer(a.token)).send({}).expect(422);
    });

    it('keeps exactly one default address and scopes addresses to their owner', async () => {
      const { token } = await login();
      const address = (label: string) => ({
        label,
        fullName: 'Ayesha Malik',
        phone: '0300 1234567',
        line1: 'House 12, Street 4, DHA Phase 5',
        city: 'Lahore',
        postalCode: '54000',
      });
      const post = (body: object) =>
        http().post(api('/account/addresses')).set(bearer(token)).send(body);

      const home = (await post(address('Home')).expect(201)).body;
      expect(home).toMatchObject({ isDefault: true, phone: '+923001234567' });
      const office = (await post({ ...address('Office'), isDefault: true }).expect(201)).body;
      expect(office.isDefault).toBe(true);

      let list = (await http().get(api('/account/addresses')).set(bearer(token))).body;
      expect(
        list.map((a: { label: string; isDefault: boolean }) => [a.label, a.isDefault]),
      ).toEqual([
        ['Office', true],
        ['Home', false],
      ]);

      await http()
        .patch(api(`/account/addresses/${home.id as string}`))
        .set(bearer(token))
        .send({ city: 'Karachi', isDefault: true })
        .expect(200);
      await http()
        .delete(api(`/account/addresses/${home.id as string}`))
        .set(bearer(token))
        .expect(204);
      list = (await http().get(api('/account/addresses')).set(bearer(token))).body;
      expect(list).toEqual([expect.objectContaining({ label: 'Office', isDefault: true })]);

      await post({ ...address('Bad'), postalCode: '123' }).expect(422);

      // Another customer cannot see or change it.
      const intruder = await login();
      await http()
        .patch(api(`/account/addresses/${office.id as string}`))
        .set(bearer(intruder.token))
        .send({ city: 'Quetta' })
        .expect(404);
      await http()
        .delete(api(`/account/addresses/${office.id as string}`))
        .set(bearer(intruder.token))
        .expect(404);
    });
  });
});
