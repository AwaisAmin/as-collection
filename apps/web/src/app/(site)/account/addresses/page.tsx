import type { Metadata } from 'next';

import { AddressBook } from '@/features/auth/components/address-book';
import { authService } from '@/features/auth/services/auth.service';
import { requireUser } from '@/features/auth/session';

export const metadata: Metadata = { title: 'Addresses' };

export default async function AccountAddressesPage() {
  const user = await requireUser('/account/addresses');
  const addresses = await authService.listAddresses(user.id);
  return (
    <AddressBook addresses={addresses} defaults={{ recipientName: user.name, phone: user.phone }} />
  );
}
