import { OrganizationJsonLd } from '@/components/seo/organization-json-ld';
import { getHomeSections } from '@/features/content/services/home-page';
import { getStoreSettings } from '@/features/content/services/store-content';
import { HomeSections } from '@/features/home/components/home-sections';

/** Home page — the sections staff arranged in the admin (order, visibility, schedule). */
export default async function HomePage() {
  const [sections, settings] = await Promise.all([getHomeSections(), getStoreSettings()]);
  return (
    <main id="main-content" className="flex-1">
      <OrganizationJsonLd />
      <HomeSections sections={sections} settings={settings} />
    </main>
  );
}
