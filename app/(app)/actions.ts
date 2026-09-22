'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { collectAll } from '@/src/facts/collect';
import { setBlockStatus } from '@/src/plan/blocks-repo';

export async function refreshFacts() {
  const result = await collectAll();
  await db
    .insert(sourcesCache)
    .values({ source: 'collect_status', payload: result, fetchedAt: new Date() })
    .onConflictDoUpdate({ target: sourcesCache.source, set: { payload: result, fetchedAt: new Date() } });
  revalidatePath('/');
}

export async function markBlockDone(formData: FormData) {
  await setBlockStatus(Number(formData.get('id')), 'done');
  revalidatePath('/');
}

export async function markBlockSkipped(formData: FormData) {
  await setBlockStatus(Number(formData.get('id')), 'skipped');
  revalidatePath('/');
}
