import { Logo } from '@/components/brand/logo';
import { Container } from '@/components/ui/container';

import { AccountLink } from './account-link';
import { CartLink } from './cart-link';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';

export function Header() {
  return (
    <header className="border-b border-gold bg-ivory">
      {/* Desktop (lg+) */}
      <Container className="hidden h-[110px] items-center lg:flex">
        <Logo />
        <MainNav className="mr-6 ml-auto xl:mr-10" />
        <SearchForm inputId="header-search" className="w-[190px] xl:w-[220px]" />
        <div className="ml-6 flex items-center gap-4 xl:ml-9 xl:gap-5">
          <AccountLink />
          <CartLink />
        </div>
      </Container>

      {/* Mobile / tablet (< lg): hamburger · centered logo · cart */}
      <Container className="grid h-[84px] grid-cols-[1fr_auto_1fr] items-center lg:hidden">
        <div className="justify-self-start">
          <MobileNav />
        </div>
        <Logo size="sm" />
        <div className="flex items-center gap-2 justify-self-end">
          <AccountLink className="hidden sm:inline-flex" />
          <CartLink />
        </div>
      </Container>
    </header>
  );
}
