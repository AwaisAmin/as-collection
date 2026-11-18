import { GoldLeafBranch } from '@/components/ornaments/gold-leaf-branch';
import { Button } from '@/components/ui/button';
import { Container } from '@/components/ui/container';
import { OrnamentDivider } from '@/components/ui/ornament-divider';
import { SocialLinks } from '@/components/ui/social-links';
import { VerticalDivider } from '@/components/ui/vertical-divider';

/** Temporary design-system preview — replaced by real sections in step 4+. */
export default function HomePage() {
  return (
    <main id="main-content" className="flex-1 py-12">
      <Container className="flex flex-col gap-10">
        <section className="flex items-end gap-6">
          <h1 className="font-display text-7xl tracking-tight">AS Collection Hub</h1>
          <GoldLeafBranch className="h-20 w-24" />
        </section>
        <p className="font-caps text-[22px] tracking-[0.35em] uppercase">
          Shop Smart • Look Elegant
        </p>
        <p className="font-script text-[44px]">Because You Deserve the Best ♡</p>
        <p className="text-[19px] text-muted">
          Body text — Cormorant Garamond. Free Shipping on Orders Above 2500.
        </p>

        <div className="flex flex-wrap items-center gap-6">
          <Button size="lg" withArrow>
            Shop Now
          </Button>
          <Button size="sm" withArrow>
            Shop Now
          </Button>
          <Button>Home</Button>
          <Button variant="gold" className="px-10 py-3 text-[22px]">
            Subscribe
          </Button>
        </div>

        <div className="flex items-center gap-8">
          <OrnamentDivider />
          <div className="flex h-10 gap-6">
            <VerticalDivider />
            <VerticalDivider tone="dark" />
          </div>
        </div>

        <div className="flex items-center gap-10 rounded-card bg-ink p-6 shadow-soft">
          <SocialLinks />
          <SocialLinks variant="circle" />
          <GoldLeafBranch flip className="h-16 w-20" />
        </div>

        <div className="grid grid-cols-6 gap-3 text-xs">
          {['bg-ink', 'bg-cream', 'bg-ivory', 'bg-sand', 'bg-gold', 'bg-gold-gradient'].map((c) => (
            <div key={c} className={`${c} h-16 rounded-card border border-gold/40`} />
          ))}
        </div>
      </Container>
    </main>
  );
}
