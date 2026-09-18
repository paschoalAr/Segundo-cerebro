import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/src/db';
import { knowledge } from '@/src/db/schema';
import type { KnowledgeDoc } from './parse';

export async function listKnowledge() {
  return db
    .select({
      id: knowledge.id,
      slug: knowledge.slug,
      title: knowledge.title,
      source: knowledge.source,
      updatedAt: knowledge.updatedAt,
    })
    .from(knowledge)
    .orderBy(knowledge.title);
}

export async function listClaudeMemorySlugs(): Promise<string[]> {
  const rows = await db
    .select({ slug: knowledge.slug })
    .from(knowledge)
    .where(eq(knowledge.source, 'claude-memory'));
  return rows.map((r) => r.slug);
}

export async function upsertClaudeMemory(doc: KnowledgeDoc) {
  await db
    .insert(knowledge)
    .values({ ...doc, source: 'claude-memory', updatedAt: new Date() })
    .onConflictDoUpdate({
      target: knowledge.slug,
      set: { title: doc.title, content: doc.content, updatedAt: new Date() },
    });
}

export async function deleteClaudeMemory(slugs: string[]) {
  if (slugs.length === 0) return;
  await db
    .delete(knowledge)
    .where(and(eq(knowledge.source, 'claude-memory'), inArray(knowledge.slug, slugs)));
}
