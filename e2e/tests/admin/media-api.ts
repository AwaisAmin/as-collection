import { expect, request as http } from '@playwright/test';

const API = 'http://127.0.0.1:4100/api/v1';

/** Deletes a staff member's unused uploads from the library and storage; returns how many. */
export async function removeOwnImages(token: string, staffName: string): Promise<number> {
  if (!token) return 0;
  const api = await http.newContext({ extraHTTPHeaders: { Authorization: `Bearer ${token}` } });
  try {
    const library = await api.get(`${API}/admin/media?unused=1&limit=100`);
    if (!library.ok()) return 0;
    const { items } = (await library.json()) as {
      items: { id: string; uploadedBy: { name: string } | null }[];
    };
    const own = items.filter((m) => m.uploadedBy?.name === staffName);
    for (const media of own) {
      expect((await api.delete(`${API}/admin/media/${media.id}`)).status()).toBe(204);
    }
    return own.length;
  } finally {
    await api.dispose();
  }
}
