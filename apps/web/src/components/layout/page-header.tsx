import { type BreadcrumbItem, Breadcrumbs } from '@/components/ui/breadcrumbs';
import { Container } from '@/components/ui/container';
import { SectionHeading } from '@/components/ui/section-heading';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs: readonly BreadcrumbItem[];
}

/** Sand band with breadcrumbs + page title (h1) used by inner pages. */
export function PageHeader({ title, subtitle, breadcrumbs }: PageHeaderProps) {
  return (
    <div className="border-b border-gold/50 bg-sand">
      <Container className="flex flex-col items-center gap-5 py-9 sm:py-11">
        <Breadcrumbs items={breadcrumbs} />
        <SectionHeading as="h1" title={title} subtitle={subtitle} />
      </Container>
    </div>
  );
}
