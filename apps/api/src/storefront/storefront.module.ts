import { Global, Module } from '@nestjs/common';

import { StorefrontRevalidator } from './storefront-revalidator.js';

/** Global: every module that invalidates caches also refreshes the storefront. */
@Global()
@Module({ providers: [StorefrontRevalidator], exports: [StorefrontRevalidator] })
export class StorefrontModule {}
