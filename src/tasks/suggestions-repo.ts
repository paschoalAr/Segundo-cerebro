import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { taskSuggestions } from '@/src/db/schema';
import { createTask } from './repo';
import type { Sector } from '@/src/sectors/sector';

export async function listPendingTaskSuggestions() {
  return db
    .select()
    .from(taskSuggestions)
    .where(eq(taskSuggestions.status, 'pending'))
    .orderBy(desc(taskSuggestions.createdAt));
}

export async function createTaskSuggestion(input: {
  title: string;
  sector: Sector | null;
  due: Date | null;
  reason: string;
  fromQuestionId: number | null;
  runId: number;
}): Promise<void> {
  await db.insert(taskSuggestions).values(input);
}

/**
 * Aceitar cria a tarefa e marca a sugestão. `title` opcional permite aceitar uma versão
 * editada, igual à tela de sugestões do manual.
 */
export async function acceptTaskSuggestion(id: number, title?: string): Promise<number | null> {
  const row = await db.query.taskSuggestions.findFirst({ where: eq(taskSuggestions.id, id) });
  if (!row || row.status !== 'pending') return null;

  const taskId = await createTask({
    title: title ?? row.title,
    sector: row.sector,
    due: row.due,
    origin: 'motor',
    fromSuggestionId: row.id,
  });

  await db.update(taskSuggestions).set({ status: 'accepted' }).where(eq(taskSuggestions.id, id));
  return taskId;
}

export async function rejectTaskSuggestion(id: number): Promise<void> {
  await db.update(taskSuggestions).set({ status: 'rejected' }).where(eq(taskSuggestions.id, id));
}

export async function countPendingTaskSuggestions(): Promise<number> {
  const rows = await db
    .select({ id: taskSuggestions.id })
    .from(taskSuggestions)
    .where(eq(taskSuggestions.status, 'pending'));
  return rows.length;
}
