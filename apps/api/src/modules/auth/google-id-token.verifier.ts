import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, errors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { z } from 'zod';

import type { AppConfig } from '../../app.module.js';
import { DomainException } from '../../common/http/problem-details.js';

/** Google's signing keys; overridable in tests with a local key set. */
export const GOOGLE_JWKS = Symbol('GOOGLE_JWKS');

export const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];
const GOOGLE_CERTS_URL = 'https://www.googleapis.com/oauth2/v3/certs';

export const createGoogleJwks = (): JWTVerifyGetKey =>
  createRemoteJWKSet(new URL(GOOGLE_CERTS_URL), {
    timeoutDuration: 5_000,
    cooldownDuration: 30_000,
    cacheMaxAge: 6 * 60 * 60_000, // Google rotates keys roughly weekly; unknown kids refetch
  });

export interface GoogleIdentity {
  sub: string;
  /** Only set when Google verified it. */
  email: string | null;
  name: string | null;
}

const claimsSchema = z.object({
  sub: z.string().min(1).max(255),
  email: z.email().max(254).optional(),
  email_verified: z.boolean().optional(),
  name: z.string().max(120).optional(),
});

/**
 * Verifies a Google Identity Services ID token (the `credential` the browser receives): RS256
 * signature against Google's keys, issuer, audience (our client ids) and expiry.
 */
@Injectable()
export class GoogleIdTokenVerifier {
  private readonly audiences: string[];

  constructor(
    @Inject(GOOGLE_JWKS) private readonly keys: JWTVerifyGetKey,
    @Inject(ConfigService) config: AppConfig,
  ) {
    this.audiences = config.get('GOOGLE_CLIENT_IDS', { infer: true });
  }

  get enabled(): boolean {
    return this.audiences.length > 0;
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.enabled) {
      throw new DomainException(
        HttpStatus.SERVICE_UNAVAILABLE,
        'GOOGLE_SIGNIN_DISABLED',
        'Google sign-in is not available right now.',
      );
    }
    try {
      const { payload } = await jwtVerify(idToken, this.keys, {
        issuer: GOOGLE_ISSUERS,
        audience: this.audiences,
        algorithms: ['RS256'],
        requiredClaims: ['sub', 'exp', 'iat'],
        clockTolerance: 5,
      });
      const claims = claimsSchema.parse(payload);
      return {
        sub: claims.sub,
        email: claims.email && claims.email_verified ? claims.email.toLowerCase() : null,
        name: claims.name?.trim() ?? null,
      };
    } catch (error) {
      // Key-fetch outages are ours, not the client's.
      if (error instanceof errors.JWKSTimeout) {
        throw new DomainException(
          HttpStatus.SERVICE_UNAVAILABLE,
          'GOOGLE_UNAVAILABLE',
          'Google sign-in is temporarily unavailable. Please try again.',
        );
      }
      throw new DomainException(
        HttpStatus.UNAUTHORIZED,
        'GOOGLE_TOKEN_INVALID',
        'Google sign-in could not be verified. Please try again.',
      );
    }
  }
}
