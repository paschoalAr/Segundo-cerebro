import 'dotenv/config';
import { db } from '@/src/db';
import { facts, planBlocks } from '@/src/db/schema';

function count(rows: { sector: string | null }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) {
    const key = r.sector ?? 'sem setor';
    out[key] = (out[key] ?? 0) + 1;
  }
  return out;
}

const f = await db.select({ sector: facts.sector }).from(facts);
const b = await db.select({ sector: planBlocks.sector }).from(planBlocks);
console.log('facts:', count(f));
console.log('blocks:', count(b));
