import { InvalidEnvironmentError, parseEnv } from './env.js';

describe('parseEnv', () => {
  it('applies safe defaults for local development', () => {
    const env = parseEnv({});
    expect(env).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      LOG_LEVEL: 'log',
      CORS_ORIGINS: [],
      TRUST_PROXY: 'loopback',
      SWAGGER_ENABLED: true,
    });
  });

  it('parses a comma-separated origin list', () => {
    const env = parseEnv({ CORS_ORIGINS: 'http://localhost:3000, https://admin.example.com' });
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:3000', 'https://admin.example.com']);
  });

  it('rejects origins with a path or trailing slash', () => {
    expect(() => parseEnv({ CORS_ORIGINS: 'https://example.com/' })).toThrow(/CORS_ORIGINS/);
  });

  it('requires CORS origins and disables API docs by default in production', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(InvalidEnvironmentError);
    const env = parseEnv({ NODE_ENV: 'production', CORS_ORIGINS: 'https://example.com' });
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('reports every invalid variable at once', () => {
    try {
      parseEnv({ PORT: 'abc', LOG_LEVEL: 'loud' });
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidEnvironmentError);
      const { issues } = error as InvalidEnvironmentError;
      expect(issues.some((i) => i.startsWith('PORT'))).toBe(true);
      expect(issues.some((i) => i.startsWith('LOG_LEVEL'))).toBe(true);
    }
  });
});
