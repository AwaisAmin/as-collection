import { ButtonLink } from '@/components/ui/button';
import { OrnamentDivider } from '@/components/ui/ornament-divider';

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-24 text-center">
      <p className="font-caps text-sm tracking-[0.35em] text-muted uppercase">404</p>
      <h1 className="font-display text-[40px] leading-tight">Page not found</h1>
      <OrnamentDivider width={120} />
      <p className="max-w-md text-[19px] text-muted">
        The page you&apos;re looking for doesn&apos;t exist.
      </p>
      <ButtonLink href="/" withArrow>
        Back to Home
      </ButtonLink>
    </main>
  );
}
