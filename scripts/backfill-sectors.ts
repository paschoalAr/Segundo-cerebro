import 'dotenv/config';
import { eq, isNull } from 'drizzle-orm';
import { db } from '@/src/db';
import { facts, planBlocks } from '@/src/db/schema';
import { calendarSectorMap } from '@/src/sectors/config';
import { deriveBlockSector, deriveFactSector } from '@/src/sectors/derive';

/**
 * Preenche `sector` nas linhas criadas antes da etapa 2. Só toca onde `sector IS NULL`,
 * então rodar de novo é inofensivo — e uma linha que continuar NULL depois disso é uma
 * linha que a regra realmente não sabe classificar (gcal fora do mapa, inbox, travel).
 */
async function main() {
  const map = calendarSectorMap();

  const factRows = await db
    .select({ id: facts.id, source: facts.source, meta: facts.meta })
    .from(facts)
    .where(isNull(facts.sector));

  let factsUpdated = 0;
  for (const row of factRows) {
    const sector = deriveFactSector({ source: row.source, meta: row.meta }, map);
    if (sector === null) continue;
    await db.update(facts).set({ sector }).where(eq(facts.id, row.id));
    factsUpdated++;
  }

  const blockRows = await db
    .select({ id: planBlocks.id, kind: planBlocks.kind, factId: planBlocks.factId })
    .from(planBlocks)
    .where(isNull(planBlocks.sector));

  let blocksUpdated = 0;
  for (const row of blockRows) {
    const factSector =
      row.factId === null
        ? null
        : ((await db.query.facts.findFirst({ where: eq(facts.id, row.factId), columns: { sector: true } }))?.sector ??
          null);
    const sector = deriveBlockSector(row.kind, factSector);
    if (sector === null) continue;
    await db.update(planBlocks).set({ sector }).where(eq(planBlocks.id, row.id));
    blocksUpdated++;
  }

  console.log(
    `facts: ${factsUpdated}/${factRows.length} preenchidos · blocos: ${blocksUpdated}/${blockRows.length} preenchidos`,
  );
  console.log('o que sobrou sem setor é gcal fora do SECTOR_CALENDAR_MAP, inbox, ou bloco travel sem fato.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
