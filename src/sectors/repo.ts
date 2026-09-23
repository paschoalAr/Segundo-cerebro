import { and, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/src/db';
import { facts, planBlocks } from '@/src/db/schema';
import { summarizeSectors, type SectorSummaries } from './summary';
import type { Sector } from './sector';

/** Blocos da semana + fatos daqui até o fim do horizonte, já agrupados por setor. */
export async function sectorOverview(
  weekStart: Date,
  weekEnd: Date,
  horizonEnd: Date,
  now: Date = new Date(),
): Promise<SectorSummaries> {
  const [blockRows, factRows] = await Promise.all([
    db
      .select({ sector: planBlocks.sector, start: planBlocks.start })
      .from(planBlocks)
      .where(and(gte(planBlocks.start, weekStart), lte(planBlocks.start, weekEnd))),
    db
      .select({ sector: facts.sector, title: facts.title, date: facts.date })
      .from(facts)
      .where(and(gte(facts.date, now), lte(facts.date, horizonEnd))),
  ]);

  return summarizeSectors(blockRows, factRows);
}

/** Agenda de um setor: fatos e blocos daquele setor na janela pedida. */
export async function listSectorAgenda(sector: Sector, start: Date, end: Date) {
  const [sectorFacts, sectorBlocks] = await Promise.all([
    db
      .select()
      .from(facts)
      .where(and(eq(facts.sector, sector), gte(facts.date, start), lte(facts.date, end)))
      .orderBy(facts.date),
    db
      .select()
      .from(planBlocks)
      .where(and(eq(planBlocks.sector, sector), gte(planBlocks.start, start), lte(planBlocks.start, end)))
      .orderBy(planBlocks.start),
  ]);

  return { facts: sectorFacts, blocks: sectorBlocks };
}
