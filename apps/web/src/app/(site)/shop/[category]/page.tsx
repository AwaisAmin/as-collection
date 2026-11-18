import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { PagePlaceholder } from '@/components/shared/page-placeholder';
import { categories, getCategory } from '@/config/catalog';

export function generateStaticParams() {
  return categories.map(({ slug }) => ({ category: slug }));
}

export async function generateMetadata({
  params,
}: PageProps<'/shop/[category]'>): Promise<Metadata> {
  const { category } = await params;
  return { title: getCategory(category)?.name ?? 'Shop' };
}

export default async function CategoryPage({ params }: PageProps<'/shop/[category]'>) {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  return (
    <PagePlaceholder
      title={category.name}
      description={`Our ${category.name.toLowerCase()} collection is coming soon.`}
    />
  );
}
