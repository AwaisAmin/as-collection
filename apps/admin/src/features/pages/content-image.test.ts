import { describe, expect, it } from 'vitest';

import { nextId, percentPosition, previewSrc, toContentSrc } from './content-image';

describe('section images', () => {
  it('stores library URLs the way the shop accepts them', () => {
    expect(toContentSrc('http://localhost:3000/media/abc/full.webp')).toBe('/media/abc/full.webp');
    expect(toContentSrc('https://cdn.example.com/media/abc/full.webp')).toBe(
      'https://cdn.example.com/media/abc/full.webp',
    );
    expect(toContentSrc('/images/brand/story.jpg')).toBe('/images/brand/story.jpg');
  });

  it('shows site paths from the shop', () => {
    expect(previewSrc('/images/a.jpg', 'http://localhost:3000')).toBe(
      'http://localhost:3000/images/a.jpg',
    );
    expect(previewSrc('https://cdn.example.com/x.webp', 'http://localhost:3000')).toBe(
      'https://cdn.example.com/x.webp',
    );
    expect(previewSrc('', 'http://localhost:3000')).toBe('');
  });

  it('makes unique ids and hotspot positions', () => {
    expect(nextId('post', ['post-1', 'post-2'])).toBe('post-3');
    expect(nextId('post', ['post-3'])).toBe('post-2');
    expect(nextId('post', ['post-2', 'post-1'])).toBe('post-3');
    expect(
      percentPosition({ x: 150, y: 80 }, { left: 100, top: 40, width: 200, height: 400 }),
    ).toEqual({ x: 25, y: 10 });
    expect(
      percentPosition({ x: 0, y: 999 }, { left: 10, top: 0, width: 100, height: 100 }),
    ).toEqual({ x: 0, y: 100 });
  });
});
