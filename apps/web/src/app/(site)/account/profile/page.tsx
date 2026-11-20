import type { Metadata } from 'next';

import { DeviceSessions } from '@/features/auth/components/device-sessions';
import { ProfileForm } from '@/features/auth/components/profile-form';
import { authService } from '@/features/auth/services/auth.service';
import { requireSession } from '@/features/auth/session';

export const metadata: Metadata = { title: 'Profile' };

export default async function AccountProfilePage() {
  const { user, token } = await requireSession('/account/profile');
  const sessions = await authService.listSessions(token);
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-5">
        <h2 className="font-display text-[28px]">Profile</h2>
        <ProfileForm user={user} />
      </div>
      <DeviceSessions sessions={sessions} />
    </div>
  );
}
