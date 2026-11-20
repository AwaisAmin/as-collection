import 'server-only';

import type { AdminAttributeDto, AdminBrandDto, AdminCategoryNodeDto } from '@as/contracts';

import { apiRequest } from '@/lib/api/http-client';

import type { CategoryOption } from './components/product-editor';

/** Categories as an indented list, each with the details it asks products for. */
function categoryOptions(nodes: readonly AdminCategoryNodeDto[]): CategoryOption[] {
  return nodes.flatMap((node) => [
    {
      id: node.id,
      label: `${'— '.repeat(node.depth)}${node.name}`,
      isActive: node.isActive,
      attributes: node.attributes.map((a) => ({
        attributeId: a.attributeId,
        isRequired: a.isRequired,
      })),
    },
    ...categoryOptions(node.children),
  ]);
}

/** Everything the product editor chooses from; null when the API can't be reached. */
export async function loadEditorData(token: string) {
  try {
    const [tree, attributes, brands] = await Promise.all([
      apiRequest<AdminCategoryNodeDto[]>('/admin/categories', { token }),
      apiRequest<AdminAttributeDto[]>('/admin/attributes', { token }),
      apiRequest<AdminBrandDto[]>('/admin/brands', { token }),
    ]);
    return { categories: categoryOptions(tree), attributes, brands };
  } catch {
    return null;
  }
}
