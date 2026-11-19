import { createLocalJWKSet, exportJWK, generateKeyPair, type JWK, SignJWT } from 'jose';

import type { AppConfig } from '../../app.module.js';
import { DomainException } from '../../common/http/problem-details.js';
import { GoogleIdTokenVerifier } from './google-id-token.verifier.js';

const CLIENT_ID = 'web-client.apps.googleusercontent.com';

async function setup(clientIds = [CLIENT_ID]) {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk: JWK = { ...(await exportJWK(publicKey)), kid: 'k1', alg: 'RS256', use: 'sig' };
  const config = { get: () => clientIds } as unknown as AppConfig;
  const verifier = new GoogleIdTokenVerifier(createLocalJWKSet({ keys: [jwk] }), config);
  const sign = (claims: Record<string, unknown>, options: { iss?: string; aud?: string } = {}) =>
    new SignJWT(claims)
      .setProtectedHeader({ alg: 'RS256', kid: 'k1' })
      .setIssuer(options.iss ?? 'https://accounts.google.com')
      .setAudience(options.aud ?? CLIENT_ID)
      .setSubject('google-sub-1')
      .setIssuedAt()
      .setExpirationTime('10m')
      .sign(privateKey);
  return { verifier, sign };
}

const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return 'resolved';
  } catch (error) {
    return error instanceof DomainException ? error.code : 'other';
  }
};

describe('GoogleIdTokenVerifier', () => {
  it('accepts a valid token and keeps only a verified email', async () => {
    const { verifier, sign } = await setup();
    await expect(
      verifier.verify(
        await sign({ email: 'Sana@Example.com', email_verified: true, name: ' Sana ' }),
      ),
    ).resolves.toEqual({ sub: 'google-sub-1', email: 'sana@example.com', name: 'Sana' });
    await expect(
      verifier.verify(await sign({ email: 'x@example.com', email_verified: false })),
    ).resolves.toMatchObject({ email: null });
  });

  it('rejects tokens for another client, from another issuer, or tampered', async () => {
    const { verifier, sign } = await setup();
    expect(await codeOf(verifier.verify(await sign({}, { aud: 'other-client' })))).toBe(
      'GOOGLE_TOKEN_INVALID',
    );
    expect(await codeOf(verifier.verify(await sign({}, { iss: 'https://evil.example' })))).toBe(
      'GOOGLE_TOKEN_INVALID',
    );
    const token = await sign({ email: 'a@example.com', email_verified: true });
    const [header, , signature] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ sub: 'admin', aud: CLIENT_ID })).toString(
      'base64url',
    );
    expect(await codeOf(verifier.verify(`${header ?? ''}.${forged}.${signature ?? ''}`))).toBe(
      'GOOGLE_TOKEN_INVALID',
    );
    expect(await codeOf(verifier.verify('not-a-jwt'))).toBe('GOOGLE_TOKEN_INVALID');
  });

  it('is disabled without client ids', async () => {
    const { verifier, sign } = await setup([]);
    expect(verifier.enabled).toBe(false);
    expect(await codeOf(verifier.verify(await sign({})))).toBe('GOOGLE_SIGNIN_DISABLED');
  });
});
