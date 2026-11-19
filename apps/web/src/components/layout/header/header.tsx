import { Logo } from '@/components/brand/logo';
import { Container } from '@/components/ui/container';

import { AccountLink } from './account-link';
import { CartLink } from './cart-link';
import { MainNav } from './main-nav';
import { MobileNav } from './mobile-nav';
import { SearchForm } from './search-form';

export function Header() {
  // `relative`: the desktop Shop mega menu is positioned against the header.
  return (
    <header className="relative border-b border-gold bg-ivory">
      {/* Desktop (lg+) */}
      <Container className="hidden h-27.5 items-center lg:flex">
        <Logo />
        <MainNav className="mr-6 ml-auto xl:mr-10" />
        <SearchForm inputId="header-search" className="w-47.5 xl:w-55" />
        <div className="ml-6 flex items-center gap-4 xl:ml-9 xl:gap-5">
          <AccountLink />
          <CartLink />
        </div>
      </Container>

      {/* Mobile / tablet (< lg): hamburger · centered logo · cart */}
      <Container className="grid h-21 grid-cols-[1fr_auto_1fr] items-center lg:hidden">
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
