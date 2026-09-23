import { desc, eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { manualSuggestions } from '@/src/db/schema';
import { appendToSection } from './sections';
import { getManual, saveManual } from './repo';

export async function listPendingSuggestions() {
  return db
    .select()
    .from(manualSuggestions)
    .where(eq(manualSuggestions.status, 'pending'))
    .orderBy(desc(manualSuggestions.createdAt));
}

export async function createSuggestion(
  section: string,
  text: string,
  fromQuestionId: number | null,
  runId: number,
): Promise<void> {
  await db.insert(manualSuggestions).values({ section, text, fromQuestionId, runId });
}

/** `text` opcional deixa aceitar uma versão editada (tela Pendências: "editar e aceitar"). */
export async function acceptSuggestion(id: number, text?: string): Promise<void> {
  const row = await db.query.manualSuggestions.findFirst({ where: eq(manualSuggestions.id, id) });
  if (!row) return;

  const manual = await getManual();
  await saveManual(appendToSection(manual.content, row.section, text ?? row.text));
  await db.update(manualSuggestions).set({ status: 'accepted' }).where(eq(manualSuggestions.id, id));
}

export async function rejectSuggestion(id: number): Promise<void> {
  await db.update(manualSuggestions).set({ status: 'rejected' }).where(eq(manualSuggestions.id, id));
}

export async function countPendingSuggestions(): Promise<number> {
  const rows = await db
    .select({ id: manualSuggestions.id })
    .from(manualSuggestions)
    .where(eq(manualSuggestions.status, 'pending'));
  return rows.length;
}
