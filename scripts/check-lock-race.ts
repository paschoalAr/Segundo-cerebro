import 'dotenv/config';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { inArray } from 'drizzle-orm';
import { db } from '../src/db';
import { planRuns } from '../src/db/schema';
import { RunLockedError } from '../src/runs/lock';
import { createRun, reapStaleRuns } from '../src/runs/repo';

const WORKERS = 3;
/** Folga pro `tsx` de cada processo compilar e aquecer antes do instante combinado. */
const ALIGN_MS = 15_000;

async function runWorker(label: string, startAt: number): Promise<void> {
  // Todos os processos esperam o mesmo instante de parede — é o que maximiza a corrida.
  while (Date.now() < startAt) await new Promise((r) => setTimeout(r, 1));
  try {
    await reapStaleRuns();
    const id = await createRun('manual');
    console.log(`${label} CREATED ${id}`);
  } catch (e) {
    if (e instanceof RunLockedError) console.log(`${label} BLOCKED`);
    else console.log(`${label} ERROR ${e instanceof Error ? e.message : String(e)}`);
  }
}

function spawnWorker(label: string, startAt: number): Promise<string> {
  const self = fileURLToPath(import.meta.url);
  return new Promise((resolve, reject) => {
    const child = spawn('npx', ['tsx', self, '--worker', label, String(startAt)], { shell: true });
    let out = '';
    child.stdout.on('data', (d) => (out += String(d)));
    child.stderr.on('data', (d) => process.stderr.write(d));
    child.on('close', () => resolve(out.trim()));
    child.on('error', reject);
  });
}

async function main() {
  if (process.argv[2] === '--worker') {
    await runWorker(process.argv[3], Number(process.argv[4]));
    return;
  }

  const startAt = Date.now() + ALIGN_MS;
  console.log(`Disparando ${WORKERS} processos alinhados em ${ALIGN_MS / 1000}s...`);
  const outputs = await Promise.all(
    Array.from({ length: WORKERS }, (_, i) => spawnWorker(`W${i + 1}`, startAt)),
  );
  for (const o of outputs) console.log('  ' + o);

  const created = outputs.filter((o) => o.includes('CREATED'));
  const blocked = outputs.filter((o) => o.includes('BLOCKED'));
  const ids = created.map((o) => Number(o.split('CREATED ')[1]));

  if (ids.length) {
    await db.delete(planRuns).where(inArray(planRuns.id, ids));
    console.log(`Limpeza: removidos ${ids.map((i) => '#' + i).join(', ')}`);
  }

  const ok = created.length === 1 && blocked.length === WORKERS - 1;
  console.log(
    ok
      ? `OK — 1 processo criou o run, ${blocked.length} foram barrados.`
      : `FALHA — criados=${created.length}, barrados=${blocked.length} (esperado 1 e ${WORKERS - 1})`,
  );
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
