import { InvalidEnvironmentError, parseEnv } from './env.js';

const DATABASE_URL = 'postgresql://u:p@localhost:5440/db';
const REDIS_URL = 'redis://:p@localhost:6390/0';
const AUTH_SECRET = 'x'.repeat(48);
const PROD = {
  DATABASE_URL,
  REDIS_URL,
  NODE_ENV: 'production',
  CORS_ORIGINS: 'https://example.com',
  AUTH_SECRET,
  OTP_CHANNELS: 'sms',
  TWILIO_ACCOUNT_SID: 'AC123',
  TWILIO_AUTH_TOKEN: 'secret',
  TWILIO_FROM: '+15005550006',
  STAFF_TOTP_KEY: Buffer.alloc(32, 7).toString('base64'),
};

describe('parseEnv', () => {
  it('applies safe defaults for local development', () => {
    const env = parseEnv({ DATABASE_URL, REDIS_URL });
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'log',
      CORS_ORIGINS: [],
      TRUST_PROXY: 'loopback',
      SWAGGER_ENABLED: true,
      DATABASE_POOL_MAX: 10,
    });
  });

  it('requires a PostgreSQL DATABASE_URL', () => {
    expect(() => parseEnv({ REDIS_URL })).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ REDIS_URL, DATABASE_URL: 'mysql://u:p@localhost/db' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('requires a Redis REDIS_URL', () => {
    expect(() => parseEnv({ DATABASE_URL })).toThrow(/REDIS_URL/);
    expect(() => parseEnv({ DATABASE_URL, REDIS_URL: 'http://localhost:6379' })).toThrow(
      /REDIS_URL/,
    );
  });

  it('normalises the media base URL (no trailing slash)', () => {
    const env = parseEnv({
      DATABASE_URL,
      REDIS_URL,
      MEDIA_PUBLIC_BASE_URL: 'https://cdn.example.com//',
    });
    expect(env.MEDIA_PUBLIC_BASE_URL).toBe('https://cdn.example.com');
  });

  it('parses a comma-separated origin list', () => {
    const env = parseEnv({
      DATABASE_URL,
      REDIS_URL,
      CORS_ORIGINS: 'http://localhost:3000, https://admin.example.com',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://admin.example.com']);
  });

  it('rejects origins with a path or trailing slash', () => {
    expect(() =>
      parseEnv({ DATABASE_URL, REDIS_URL, CORS_ORIGINS: 'https://example.com/' }),
    ).toThrow(/CORS_ORIGINS/);
  });

  it('requires CORS origins and disables API docs by default in production', () => {
    expect(() => parseEnv({ DATABASE_URL, REDIS_URL, NODE_ENV: 'production' })).toThrow(
      InvalidEnvironmentError,
    );
    const env = parseEnv(PROD);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('uses a development auth secret and logged OTPs outside production', () => {
    const env = parseEnv({ DATABASE_URL, REDIS_URL });
    expect(env.AUTH_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(env.OTP_CHANNELS).toEqual(['log']);
    expect(env.OTP_DEV_ECHO).toBe(false);
    expect(env.GOOGLE_CLIENT_IDS).toEqual([]);
  });

  it('enforces production auth settings', () => {
    const issuesOf = (raw: Record<string, string | undefined>) => {
      try {
        parseEnv(raw);
        return [];
      } catch (error) {
        return (error as InvalidEnvironmentError).issues;
      }
    };
    expect(issuesOf({ ...PROD, AUTH_SECRET: undefined })).toEqual([
      'AUTH_SECRET: is required in production',
    ]);
    expect(issuesOf({ ...PROD, OTP_CHANNELS: 'log' })[0]).toMatch(/^OTP_CHANNELS: "log"/);
    expect(issuesOf({ ...PROD, OTP_DEV_ECHO: 'true' })[0]).toMatch(/^OTP_DEV_ECHO/);
    expect(issuesOf({ ...PROD, AUTH_SECRET: 'short' })[0]).toMatch(/^AUTH_SECRET/);
  });

  it('enforces production staff security settings', () => {
    const issuesOf = (raw: Record<string, string | undefined>) => {
      try {
        parseEnv(raw);
        return [];
      } catch (error) {
        return (error as InvalidEnvironmentError).issues;
      }
    };
    expect(issuesOf({ ...PROD, STAFF_TOTP_KEY: undefined })).toEqual([
      'STAFF_TOTP_KEY: is required in production',
    ]);
    expect(issuesOf({ ...PROD, STAFF_TOTP_KEY: 'c2hvcnQ=' })[0]).toMatch(/32 bytes/);
    expect(issuesOf({ ...PROD, STAFF_REQUIRE_2FA: 'false' })).toEqual([
      'STAFF_REQUIRE_2FA: cannot be disabled in production',
    ]);
    expect(parseEnv({ DATABASE_URL, REDIS_URL }).STAFF_REQUIRE_2FA).toBe(true);
  });

  it('requires provider credentials for each OTP channel', () => {
    expect(() => parseEnv({ DATABASE_URL, REDIS_URL, OTP_CHANNELS: 'whatsapp,sms' })).toThrow(
      /whatsapp needs/,
    );
    const env = parseEnv({
      DATABASE_URL,
      REDIS_URL,
      OTP_CHANNELS: 'whatsapp, sms, whatsapp',
      WHATSAPP_PHONE_NUMBER_ID: '123',
      WHATSAPP_ACCESS_TOKEN: 'token',
      TWILIO_ACCOUNT_SID: 'AC1',
      TWILIO_AUTH_TOKEN: 't',
      TWILIO_FROM: 'MG1',
    });
    expect(env.OTP_CHANNELS).toEqual(['whatsapp', 'sms']);
  });

  it('reports every invalid variable at once', () => {
    try {
      parseEnv({ DATABASE_URL, REDIS_URL, PORT: 'abc', LOG_LEVEL: 'loud' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvironmentError);
      const { issues } = error as InvalidEnvironmentError;
      expect(issues.some((i) => i.startsWith('PORT'))).toBe(true);
      expect(issues.some((i) => i.startsWith('LOG_LEVEL'))).toBe(true);
    }
  });
});
