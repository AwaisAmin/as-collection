import { Header } from '@/components/layout/header/header';
import { SkipLink } from '@/components/layout/skip-link';
import { TopBar } from '@/components/layout/top-bar';

/** Storefront chrome shared by all customer-facing pages. */
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <SkipLink />
      <TopBar />
      <Header />
      {children}
    </>
  );
}
