import type { AppConfig } from '../app.module.js';
import { StorefrontRevalidator } from './storefront-revalidator.js';

const SECRET = 's'.repeat(40);
const configWith = (values: Record<string, string | undefined>) =>
  ({ get: (key: string) => values[key] }) as unknown as AppConfig;

describe('StorefrontRevalidator', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does nothing when the storefront URL is not configured', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const revalidator = new StorefrontRevalidator(configWith({}));
    revalidator.revalidate('catalog');
    expect(await revalidator.send(['catalog'])).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('posts the tags with the shared secret', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const revalidator = new StorefrontRevalidator(
      configWith({
        STOREFRONT_REVALIDATE_URL: 'https://shop.example/api/revalidate',
        STOREFRONT_REVALIDATE_SECRET: SECRET,
      }),
    );
    expect(await revalidator.send(['catalog', 'reviews'])).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://shop.example/api/revalidate');
    expect(init.headers).toMatchObject({ 'X-Revalidate-Secret': SECRET });
    expect(JSON.parse(init.body as string)).toEqual({ tags: ['catalog', 'reviews'] });
  });

  it('never throws: storefront errors and outages only log', async () => {
    const revalidator = new StorefrontRevalidator(
      configWith({
        STOREFRONT_REVALIDATE_URL: 'https://shop.example/api/revalidate',
        STOREFRONT_REVALIDATE_SECRET: SECRET,
      }),
    );
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })));
    expect(await revalidator.send(['settings'])).toBe(false);
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    expect(await revalidator.send(['settings'])).toBe(false);
  });
});
