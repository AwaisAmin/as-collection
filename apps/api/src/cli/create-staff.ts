/**
 * Creates a staff account with the built-in "super-admin" role — how the first administrator
 * is made (everyone else is added from the admin panel). 2FA is set up at first sign-in.
 *
 *   STAFF_EMAIL=owner@example.com STAFF_NAME="Owner" pnpm staff:create   (password on stdin)
 *   docker run -i --env-file .env <image> node dist/cli/create-staff.js  (same, in production)
 *
 * The password is read from stdin (never from argv, which other users can see in `ps`).
 */
import { createInterface } from 'node:readline';

import { PrismaPg } from '@prisma/adapter-pg';
import type { z } from 'zod';

import { loadEnvFiles, parseEnv } from '../config/env.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { emailSchema } from '../modules/newsletter/newsletter.schemas.js';
import {
  hashPassword,
  passwordMentionsEmail,
  passwordSchema,
} from '../modules/staff/security/password.js';

/** Parses or exits with the first human-readable problem (not a JSON dump). */
function valid<T>(schema: z.ZodType<T>, value: unknown, label: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new Error(`${label}: ${result.error.issues[0]?.message ?? 'invalid'}`);
  return result.data;
}

async function readPassword(): Promise<string> {
  if (process.stdin.isTTY) process.stdout.write('Password (min 12 characters): ');
  const rl = createInterface({ input: process.stdin, terminal: false });
  for await (const line of rl) {
    rl.close();
    return line;
  }
  throw new Error('No password on stdin');
}

async function main(): Promise<void> {
  loadEnvFiles();
  const env = parseEnv(process.env);
  const email = valid(emailSchema, process.env.STAFF_EMAIL ?? '', 'STAFF_EMAIL');
  const name = (process.env.STAFF_NAME ?? '').trim();
  if (name.length < 2) throw new Error('Set STAFF_NAME (at least 2 characters)');

  const password = valid(passwordSchema, await readPassword(), 'Password');
  if (passwordMentionsEmail(password, email)) throw new Error('Password contains the email name');

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: env.DATABASE_URL }),
  });
  try {
    const role = await prisma.role.findUnique({ where: { key: 'super-admin' } });
    if (!role) throw new Error('Role "super-admin" missing — run the seed first');
    if (await prisma.staffUser.findUnique({ where: { email } })) {
      throw new Error(`${email} already exists (reset it from the admin panel instead)`);
    }
    const staff = await prisma.staffUser.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        roles: { create: { roleId: role.id } },
      },
      select: { id: true },
    });
    await prisma.auditLog.create({
      data: {
        actorType: 'SYSTEM',
        action: 'staff.create',
        entityType: 'staff',
        entityId: staff.id,
        changes: { email, name, via: 'cli', role: 'super-admin' },
      },
    });
    process.stdout.write(`\nCreated super admin ${email}. Set up 2FA at first sign-in.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
