import { User } from 'lucide-react';

import { IconLink } from '@/components/ui/icon-button';

export function AccountLink({ className }: { className?: string }) {
  return (
    <IconLink href="/account" aria-label="My account" className={className}>
      <User aria-hidden size={30} strokeWidth={1.6} />
    </IconLink>
  );
}
