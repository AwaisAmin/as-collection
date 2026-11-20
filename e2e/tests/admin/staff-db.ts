import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import pg from 'pg';

/** Every staff account these tests create uses this email domain. */
export const STAFF_DOMAIN = '@e2e-admin.example.test';

const apiDir = fileURLToPath(new URL('../../../apps/api', import.meta.url));

/** Creates a super admin through the real CLI (how the first administrator is made). */
export function createStaff(email: string, name: string, password: string): void {
  // Fixed command; the inputs travel in the environment and on stdin, never in the command line.
  execSync('pnpm staff:create', {
    cwd: apiDir,
    input: `${password}\n`,
    env: { ...process.env, STAFF_EMAIL: email, STAFF_NAME: name },
    stdio: ['pipe', 'ignore', 'pipe'],
  });
}

/** Removes the test staff accounts, their sessions and their (append-only) audit entries. */
export async function cleanupStaff(): Promise<void> {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    const staff = await client.query<{ id: string }>(
      'SELECT id FROM staff_users WHERE email LIKE $1',
      [`%${STAFF_DOMAIN}`],
    );
    const ids = staff.rows.map((r) => r.id);
    if (ids.length) {
      await client.query(`SET LOCAL app.audit_purge = 'on'`);
      await client.query(
        `DELETE FROM audit_logs
          WHERE actor_staff_id = ANY($1::uuid[]) OR entity_id::text = ANY($1::text[])`,
        [ids],
      );
      await client.query('DELETE FROM staff_users WHERE id = ANY($1::uuid[])', [ids]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}
