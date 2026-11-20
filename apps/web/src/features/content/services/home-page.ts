import 'server-only';

import type { PageDto, TypedSectionDto } from '@as/contracts';
import { cacheLife, cacheTag } from 'next/cache';

import { defaultHomeSections } from '@/features/home/lib/default-sections';
import { apiFindOrNull } from '@/lib/api/http-client';
import { reportError } from '@/lib/errors/report-error';

import { liveSections } from '../lib/sections';
import { CONTENT_TAG } from './store-content';

/**
 * The home page's sections, in the order staff arranged them (published page, visible and in
 * their schedule). Falls back to the bundled design if the page is missing or cannot load.
 */
export async function getHomeSections(): Promise<readonly TypedSectionDto[]> {
  'use cache';
  cacheLife('minutes');
  cacheTag(CONTENT_TAG);
  try {
    const page = await apiFindOrNull<PageDto>('/content/pages/home');
    if (!page) return defaultHomeSections;
    return liveSections(page.sections, new Date());
  } catch (error) {
    reportError(error, { action: 'content.home' });
    return defaultHomeSections;
  }
}
