import type { Metadata } from 'next';

import { AddressBook } from '@/features/auth/components/address-book';
import { authService } from '@/features/auth/services/auth.service';
import { requireSession } from '@/features/auth/session';

export const metadata: Metadata = { title: 'Addresses' };

export default async function AccountAddressesPage() {
  const { user, token } = await requireSession('/account/addresses');
  const addresses = await authService.listAddresses(token);
  return (
    <AddressBook addresses={addresses} defaults={{ recipientName: user.name, phone: user.phone }} />
  );
}
