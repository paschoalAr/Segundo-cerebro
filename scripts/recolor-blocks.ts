/**
 * Repinta no Google Calendar os blocos que já existem, com a cor da categoria deles.
 *
 * A cor só é gravada quando o motor cria ou atualiza um evento. Os blocos planejados
 * antes das categorias existirem ficaram sem `colorId`, e um run idempotente não os
 * toca — então eles nunca ganhariam cor sozinhos. Este script fecha essa lacuna.
 * Rodar de novo é inofensivo: manda a mesma cor.
 */
import 'dotenv/config';
import { getValidAccessToken } from '@/src/google/token';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { patchEvent, toGCalEventTime } from '@/src/google/calendar';
import { gcalColorId } from '@/src/plan/categories';
import { db } from '@/src/db';
import { planBlocks } from '@/src/db/schema';
import { isNotNull } from 'drizzle-orm';

async function main() {
  const accessToken = await getValidAccessToken();
  const cerebroId = await getCerebroCalendarId(accessToken);

  const blocos = await db.select().from(planBlocks).where(isNotNull(planBlocks.gcalEventId));
  console.log(`${blocos.length} blocos com evento no calendário.`);

  const porCategoria: Record<string, number> = {};
  for (const b of blocos) {
    const colorId = gcalColorId(b.kind);
    await patchEvent(accessToken, cerebroId, b.gcalEventId!, {
      summary: b.title,
      start: toGCalEventTime(b.start),
      end: toGCalEventTime(b.end),
      colorId,
    });
    porCategoria[b.kind] = (porCategoria[b.kind] ?? 0) + 1;
    console.log(`  [${b.kind}] cor ${colorId} — ${b.title}`);
  }

  console.log('\nRepintados por categoria:', JSON.stringify(porCategoria));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Falhou:', e instanceof Error ? e.message : e);
    process.exit(1);
  });
