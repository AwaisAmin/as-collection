import { ButtonLink } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { OrnamentDivider } from '@/components/ui/ornament-divider';

interface PagePlaceholderProps {
  title: string;
  description?: string;
}

/** Temporary page body for routes that exist in navigation but aren't built yet. */
export function PagePlaceholder({
  title,
  description = 'This page is coming soon.',
}: PagePlaceholderProps) {
  return (
    <main id="main-content" className="flex-1">
      <Container className="flex flex-col items-center gap-5 py-24 text-center">
        <h1 className="font-display text-[44px] leading-tight">{title}</h1>
        <OrnamentDivider width={120} />
        <p className="max-w-md text-[19px] text-muted">{description}</p>
        <ButtonLink href="/" withArrow className="mt-2">
          Back to Home
        </ButtonLink>
      </Container>
    </main>
  );
}
