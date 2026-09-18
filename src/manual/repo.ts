import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { manual } from '@/src/db/schema';
import { DEFAULT_MANUAL } from './sections';

export async function getManual(): Promise<{ content: string; updatedAt: Date }> {
  const row = await db.query.manual.findFirst({ where: eq(manual.id, 1) });
  if (row) return { content: row.content, updatedAt: row.updatedAt };
  await db.insert(manual).values({ id: 1, content: DEFAULT_MANUAL }).onConflictDoNothing();
  return { content: DEFAULT_MANUAL, updatedAt: new Date() };
}

export async function saveManual(content: string): Promise<void> {
  const normalized = content.replace(/\r\n?/g, '\n');
  const now = new Date();
  await db
    .insert(manual)
    .values({ id: 1, content: normalized, updatedAt: now })
    .onConflictDoUpdate({ target: manual.id, set: { content: normalized, updatedAt: now } });
}
