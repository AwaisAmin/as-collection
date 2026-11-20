import type { AttributeScope, AttributeType } from '@as/contracts';

export const ATTRIBUTE_TYPES: Record<AttributeType, { label: string; hint: string }> = {
  SELECT: { label: 'One choice', hint: 'Pick one from a list (Fabric: Lawn).' },
  MULTI_SELECT: { label: 'Several choices', hint: 'Pick any from a list (Colour: Black, Gold).' },
  TEXT: { label: 'Text', hint: 'Free text (Care: Dry clean only).' },
  NUMBER: { label: 'Number', hint: 'A number, with an optional unit (Length: 2.5 m).' },
  BOOLEAN: { label: 'Yes / no', hint: 'Yes or no (Lined: yes).' },
};

export const ATTRIBUTE_SCOPES: Record<AttributeScope, { label: string; hint: string }> = {
  PRODUCT: {
    label: 'Product detail',
    hint: 'Describes the whole product; can be a shop filter.',
  },
  VARIANT: {
    label: 'Variant option',
    hint: 'What customers choose between (Size, Shade). One choice only.',
  },
};

export const hasValueList = (type: AttributeType) => type === 'SELECT' || type === 'MULTI_SELECT';
