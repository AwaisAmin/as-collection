'use client';

import type { AdminDiscountDto } from '@as/contracts';

import { DeleteCard } from '@/components/ui/delete-card';

import { deleteDiscount } from '../actions';

export function DeleteDiscount({ discount }: { discount: AdminDiscountDto }) {
  return (
    <DeleteCard
      what="discount"
      name={discount.code}
      blockedReason={
        discount.usageCount > 0
          ? 'Customers have used this code, so it stays for the order history. Untick “On” to stop it.'
          : null
      }
      allowedText="Never used, so it can be deleted."
      consequence="The code stops working and is removed."
      onDelete={() => deleteDiscount(discount.id)}
    />
  );
}
