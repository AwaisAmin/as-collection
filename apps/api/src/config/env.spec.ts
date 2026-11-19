import { InvalidEnvironmentError, parseEnv } from './env.js';

const DATABASE_URL = 'postgresql://u:p@localhost:5440/db';

describe('parseEnv', () => {
  it('applies safe defaults for local development', () => {
    const env = parseEnv({ DATABASE_URL });
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
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
    expect(() => parseEnv({ DATABASE_URL: 'mysql://u:p@localhost/db' })).toThrow(/DATABASE_URL/);
  });

  it('parses a comma-separated origin list', () => {
    const env = parseEnv({
      DATABASE_URL,
      CORS_ORIGINS: 'http://localhost:3000, https://admin.example.com',
    });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://admin.example.com']);
  });

  it('rejects origins with a path or trailing slash', () => {
    expect(() => parseEnv({ DATABASE_URL, CORS_ORIGINS: 'https://example.com/' })).toThrow(
      /CORS_ORIGINS/,
    );
  });

  it('requires CORS origins and disables API docs by default in production', () => {
    expect(() => parseEnv({ DATABASE_URL, NODE_ENV: 'production' })).toThrow(
      InvalidEnvironmentError,
    );
    const env = parseEnv({
      DATABASE_URL,
      NODE_ENV: 'production',
      CORS_ORIGINS: 'https://example.com',
    });
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('reports every invalid variable at once', () => {
    try {
      parseEnv({ DATABASE_URL, PORT: 'abc', LOG_LEVEL: 'loud' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvironmentError);
      const { issues } = error as InvalidEnvironmentError;
      expect(issues.some((i) => i.startsWith('PORT'))).toBe(true);
      expect(issues.some((i) => i.startsWith('LOG_LEVEL'))).toBe(true);
    }
  });
});
