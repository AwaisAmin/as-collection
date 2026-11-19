import { Module } from '@nestjs/common';

import { AuthModule } from '../auth/auth.module.js';
import { AccountController } from './account.controller.js';
import { AccountService } from './account.service.js';
import { AddressService } from './address.service.js';

/** Signed-in customer: profile, phone, address book, devices. */
@Module({
  imports: [AuthModule],
  controllers: [AccountController],
  providers: [AccountService, AddressService],
})
export class AccountModule {}
