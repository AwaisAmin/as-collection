import type { CollectionState } from '@as/contracts';

import type { BadgeTone } from '@/components/ui/badge';

export const COLLECTION_STATE: Record<CollectionState, { label: string; tone: BadgeTone }> = {
  live: { label: 'Live', tone: 'success' },
  scheduled: { label: 'Scheduled', tone: 'gold' },
  ended: { label: 'Ended', tone: 'warning' },
  hidden: { label: 'Hidden', tone: 'neutral' },
};
