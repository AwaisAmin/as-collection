'use client';

import { LogOut, MonitorSmartphone } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { formatDate, pluralize } from '@/lib/utils/format';

import { revokeOtherSessionsAction, revokeSessionAction } from '../actions';
import type { DeviceSession } from '../types';

/** Profile → devices signed in to this account, with sign-out per device or everywhere else. */
export function DeviceSessions({ sessions }: { sessions: DeviceSession[] }) {
  const [isPending, startTransition] = useTransition();
  const others = sessions.filter((s) => !s.current).length;

  function signOut(session: DeviceSession) {
    startTransition(async () => {
      await revokeSessionAction(session.id);
      toast.success(`Signed out of ${session.device}`);
    });
  }

  function signOutOthers() {
    startTransition(async () => {
      const { revoked } = await revokeOtherSessionsAction();
      toast.success(`Signed out of ${revoked} other ${pluralize(revoked, 'device')}`);
    });
  }

  return (
    <section aria-labelledby="devices-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 id="devices-heading" className="font-display text-[24px]">
            Signed-in devices
          </h3>
          <p className="text-[16px] text-muted">
            Don&apos;t recognise one? Sign it out — it will need a new code to get back in.
          </p>
        </div>
        {others > 0 ? (
          <Button size="sm" onClick={signOutOthers} disabled={isPending}>
            <LogOut aria-hidden size={16} />
            Sign out all others
          </Button>
        ) : null}
      </div>

      <ul className="flex flex-col divide-y divide-gold/40 rounded-card border border-gold bg-ivory">
        {sessions.map((session) => (
          <li key={session.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <MonitorSmartphone aria-hidden className="size-6 shrink-0 text-gold-dark" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-ink">
                {session.device}
                {session.current ? (
                  <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-[12px] font-semibold text-white">
                    This device
                  </span>
                ) : null}
              </p>
              <p className="text-[15px] text-muted">
                Signed in {formatDate(session.createdAt)} · last active{' '}
                {formatDate(session.lastSeenAt)}
              </p>
            </div>
            {session.current ? null : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut(session)}
                disabled={isPending}
                aria-label={`Sign out ${session.device}`}
              >
                Sign out
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
