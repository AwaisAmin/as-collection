import './globals.css';

import type { Metadata, Viewport } from 'next';

import { Toaster } from '@/components/ui/toaster';
import { fontVariables } from '@/lib/fonts';
import { cn } from '@/lib/utils/cn';

export const metadata: Metadata = {
  title: { default: 'AS Admin', template: '%s · AS Admin' },
  description: 'AS Collection Hub staff admin',
  applicationName: 'AS Admin',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'same-origin',
};

export const viewport: Viewport = {
  themeColor: '#111010',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={cn(fontVariables, 'h-full')}>
      <body className="min-h-full">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
