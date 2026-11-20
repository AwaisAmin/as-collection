import { Inter, Marcellus } from 'next/font/google';

/** Interface text: tables, forms, navigation. */
export const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

/** Brand mark only. */
export const marcellus = Marcellus({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-marcellus',
});

export const fontVariables = `${inter.variable} ${marcellus.variable}`;
