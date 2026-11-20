'use client';

import type { AdminAttributeDto } from '@as/contracts';

import { DeleteCard } from '@/components/ui/delete-card';

import { deleteAttribute } from '../actions';

export function DeleteAttribute({ attribute }: { attribute: AdminAttributeDto }) {
  const { products, variants, categories } = attribute.usage;
  const blocked = [
    products ? `${String(products)} product ${products === 1 ? 'value' : 'values'}` : null,
    variants ? `${String(variants)} ${variants === 1 ? 'variant' : 'variants'}` : null,
    categories ? `${String(categories)} category ${categories === 1 ? 'filter' : 'filters'}` : null,
  ].filter(Boolean);
  return (
    <DeleteCard
      what="attribute"
      name={attribute.name}
      blockedReason={
        blocked.length
          ? `Used by ${blocked.join(', ')}, so it can’t be deleted. Untick “Shop filter” and “Shown on the product page” to retire it.`
          : null
      }
      allowedText="Not used anywhere, so it can be deleted."
      consequence="The attribute and its values are removed."
      onDelete={() => deleteAttribute(attribute.id)}
    />
  );
}
