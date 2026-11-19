import type { ReactNode } from 'react';

import { PageHeader } from '@/components/layout/page-header';
import { Container } from '@/components/ui/container';

export interface LegalSection {
  id: string;
  title: string;
  body: ReactNode;
}

interface LegalPageProps {
  title: string;
  lastUpdated: string;
  intro: ReactNode;
  sections: readonly LegalSection[];
}

/** Readable long-form policy page with an on-page table of contents. */
export function LegalPage({ title, lastUpdated, intro, sections }: LegalPageProps) {
  return (
    <main id="main-content" className="flex-1">
      <PageHeader title={title} breadcrumbs={[{ label: 'Home', href: '/' }, { label: title }]} />
      <Container className="grid grid-cols-1 gap-10 py-12 lg:grid-cols-[240px_1fr] lg:gap-14">
        <nav aria-label="On this page" className="lg:sticky lg:top-6 lg:self-start">
          <p className="mb-3 font-display text-[18px]">On this page</p>
          <ol className="flex flex-col gap-1.5 border-l border-gold/60 pl-4 text-[16px]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="text-muted transition-colors hover:text-gold-dark">
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="max-w-3xl">
          <p className="text-[15px] text-muted">Last updated: {lastUpdated}</p>
          <div className="mt-4 text-[18px] leading-relaxed text-text">{intro}</div>
          {sections.map((s, i) => (
            <section
              key={s.id}
              id={s.id}
              aria-labelledby={`${s.id}-title`}
              className="mt-8 scroll-mt-6 border-t border-gold/40 pt-8"
            >
              <h2 id={`${s.id}-title`} className="font-display text-[24px]">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 flex flex-col gap-3 text-[18px] leading-relaxed text-text [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-gold [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5">
                {s.body}
              </div>
            </section>
          ))}
        </article>
      </Container>
    </main>
  );
}
