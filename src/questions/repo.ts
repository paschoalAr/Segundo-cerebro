import { and, desc, eq, gt } from 'drizzle-orm';
import { db } from '@/src/db';
import { questions } from '@/src/db/schema';

export async function listOpenQuestions() {
  return db.select().from(questions).where(eq(questions.status, 'open')).orderBy(desc(questions.askedAt));
}

export async function listAnsweredSince(since: Date) {
  return db
    .select()
    .from(questions)
    .where(and(eq(questions.status, 'answered'), gt(questions.answeredAt, since)));
}

export async function createQuestion(
  text: string,
  context: Record<string, unknown>,
  runId: number,
): Promise<number> {
  const [row] = await db.insert(questions).values({ text, context, runId }).returning({ id: questions.id });
  return row.id;
}

export async function answerQuestion(id: number, answer: string): Promise<void> {
  await db
    .update(questions)
    .set({ answer, answeredAt: new Date(), status: 'answered' })
    .where(eq(questions.id, id));
}

export async function dismissQuestion(id: number): Promise<void> {
  await db.update(questions).set({ status: 'dismissed' }).where(eq(questions.id, id));
}

export async function countOpenQuestions(): Promise<number> {
  const rows = await db.select({ id: questions.id }).from(questions).where(eq(questions.status, 'open'));
  return rows.length;
}
