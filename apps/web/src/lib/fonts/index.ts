import { Cinzel, Cormorant_Garamond, Great_Vibes, Marcellus } from 'next/font/google';

/** Display / headings — logo, hero title, nav, card titles. */
export const marcellus = Marcellus({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-marcellus',
});

/** Body / secondary text. */
export const cormorant = Cormorant_Garamond({
  weight: ['500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cormorant',
});

/** Script tagline. */
export const greatVibes = Great_Vibes({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-great-vibes',
});

/** Letter-spaced uppercase taglines. */
export const cinzel = Cinzel({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-cinzel',
});

export const fontVariables = [
  marcellus.variable,
  cormorant.variable,
  greatVibes.variable,
  cinzel.variable,
].join(' ');
