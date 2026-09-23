import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { tasks } from '@/src/db/schema';
import type { Sector } from '@/src/sectors/sector';

export type TaskInput = {
  title: string;
  sector: Sector | null;
  due: Date | null;
  origin: 'manual' | 'motor';
  notes?: string | null;
  fromSuggestionId?: number | null;
};

export async function listOpenTasks() {
  return db.select().from(tasks).where(eq(tasks.status, 'open')).orderBy(desc(tasks.createdAt));
}

export async function listOpenTasksBySector(sector: Sector) {
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.status, 'open'), eq(tasks.sector, sector)))
    .orderBy(desc(tasks.createdAt));
}

/** Ids das tarefas abertas — base do `sanitizeTaskId` na hora de aplicar o PlanOutput. */
export async function listOpenTaskIds(): Promise<number[]> {
  const rows = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.status, 'open'));
  return rows.map((r) => r.id);
}

export async function getTask(id: number) {
  return db.query.tasks.findFirst({ where: eq(tasks.id, id) });
}

export async function createTask(input: TaskInput): Promise<number> {
  const [row] = await db.insert(tasks).values(input).returning({ id: tasks.id });
  return row.id;
}

export async function completeTask(id: number): Promise<void> {
  await db.update(tasks).set({ status: 'done', doneAt: new Date() }).where(eq(tasks.id, id));
}

/** "Largar": não foi feita e não vai ser. Fica no histórico, não volta pra lista. */
export async function dropTask(id: number): Promise<void> {
  await db.update(tasks).set({ status: 'dropped' }).where(eq(tasks.id, id));
}

export async function countOpenTasks(): Promise<number> {
  const rows = await db.select({ id: tasks.id }).from(tasks).where(eq(tasks.status, 'open'));
  return rows.length;
}
