import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import { db } from '@/src/db';
import { planBlocks } from '@/src/db/schema';
import type { BlockKind } from './categories';

export type BlockInput = {
  title: string;
  start: Date;
  end: Date;
  kind: BlockKind;
  factId: number | null;
  reason: string;
};

export async function listBlocksInRange(start: Date, end: Date) {
  return db
    .select()
    .from(planBlocks)
    .where(and(gte(planBlocks.start, start), lte(planBlocks.start, end)))
    .orderBy(planBlocks.start);
}

/** Blocos ainda "planned" com evento no Cérebro — base pra computeObservations. */
export async function listPlannedBlocksWithGcalId() {
  return db
    .select({ id: planBlocks.id, title: planBlocks.title, start: planBlocks.start, gcalEventId: planBlocks.gcalEventId })
    .from(planBlocks)
    .where(and(eq(planBlocks.status, 'planned'), isNotNull(planBlocks.gcalEventId)));
}

export async function getBlock(id: number) {
  return db.query.planBlocks.findFirst({ where: eq(planBlocks.id, id) });
}

/** Insere o bloco sem gcalEventId ainda — o id gerado aqui vira extendedProperties.private.block_id no evento. */
export async function insertBlockDraft(input: BlockInput, runId: number): Promise<number> {
  const [row] = await db
    .insert(planBlocks)
    .values({ ...input, createdRunId: runId, updatedRunId: runId })
    .returning({ id: planBlocks.id });
  return row.id;
}

export async function setBlockGcalEventId(id: number, gcalEventId: string): Promise<void> {
  await db.update(planBlocks).set({ gcalEventId }).where(eq(planBlocks.id, id));
}

export async function updateBlock(
  id: number,
  input: Pick<BlockInput, 'title' | 'start' | 'end' | 'reason'>,
  runId: number,
): Promise<void> {
  await db
    .update(planBlocks)
    .set({ ...input, updatedRunId: runId })
    .where(eq(planBlocks.id, id));
}

export async function deleteBlockRow(id: number): Promise<void> {
  await db.delete(planBlocks).where(eq(planBlocks.id, id));
}

export async function setBlockStatus(id: number, status: 'done' | 'skipped'): Promise<void> {
  await db.update(planBlocks).set({ status }).where(eq(planBlocks.id, id));
}
