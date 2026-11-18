import { Search } from 'lucide-react';
import Form from 'next/form';

import { IconButton } from '@/components/ui/icon-button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';

interface SearchFormProps {
  className?: string;
  /** Unique id so multiple instances (desktop + drawer) don't clash. */
  inputId: string;
}

/** GET search → /shop?q=… (progressively enhanced with client navigation by next/form). */
export function SearchForm({ className, inputId }: SearchFormProps) {
  return (
    <Form action="/shop" role="search" className={cn('relative', className)}>
      <label htmlFor={inputId} className="sr-only">
        Search products
      </label>
      <Input
        id={inputId}
        name="q"
        type="search"
        placeholder="Search here..."
        autoComplete="off"
        maxLength={100}
        className="pr-12"
      />
      <IconButton
        type="submit"
        aria-label="Search"
        padding="none"
        className="absolute top-1/2 right-1 size-9 -translate-y-1/2"
      >
        <Search aria-hidden size={22} strokeWidth={2} />
      </IconButton>
    </Form>
  );
}
