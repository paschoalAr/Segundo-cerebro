'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { collectAll } from '@/src/facts/collect';

export async function refreshFacts() {
  const result = await collectAll();
  await db
    .insert(sourcesCache)
    .values({ source: 'collect_status', payload: result, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: sourcesCache.source, set: { payload: result, fetchedAt: new Date() } });
  revalidatePath('/');
}
