import type { Metadata } from 'next';

import { ProfileForm } from '@/features/auth/components/profile-form';
import { requireUser } from '@/features/auth/session';

export const metadata: Metadata = { title: 'Profile' };

export default async function AccountProfilePage() {
  const user = await requireUser('/account/profile');
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-display text-[28px]">Profile</h2>
      <ProfileForm user={user} />
    </div>
  );
}
