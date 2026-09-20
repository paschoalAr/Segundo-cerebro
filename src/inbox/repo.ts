import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { inboxItems } from '@/src/db/schema';

export async function addInboxItem(text: string) {
  const clean = text.trim();
  if (!clean) return;
  await db.insert(inboxItems).values({ text: clean });
}

export async function listInboxItems(limit = 50) {
  return db.select().from(inboxItems).orderBy(desc(inboxItems.createdAt)).limit(limit);
}

export async function deleteInboxItem(id: number) {
  await db.delete(inboxItems).where(eq(inboxItems.id, id));
}
