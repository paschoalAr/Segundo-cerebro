import { desc } from 'drizzle-orm';
import { db } from '@/src/db';
import { planRuns } from '@/src/db/schema';

export async function listRecentRuns(limit = 30) {
  return db.select().from(planRuns).orderBy(desc(planRuns.startedAt)).limit(limit);
}
