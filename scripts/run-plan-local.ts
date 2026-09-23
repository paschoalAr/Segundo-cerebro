import 'dotenv/config';
import { runPlanEngine } from '../src/plan/engine';

async function main() {
  const trigger = process.argv.includes('--cron') ? 'cron' : 'manual';
  const runId = await runPlanEngine(trigger);
  console.log(`[${new Date().toISOString()}] Run #${runId} concluído (trigger=${trigger}).`);
}

main().catch((e) => {
  console.error(`[${new Date().toISOString()}] Motor falhou:`, e instanceof Error ? e.message : e);
  process.exit(1);
});
