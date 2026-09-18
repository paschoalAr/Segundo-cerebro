import 'dotenv/config';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parseMemoryFile, planSync, type KnowledgeDoc } from '../src/knowledge/parse';
import {
  deleteClaudeMemory,
  listClaudeMemorySlugs,
  upsertClaudeMemory,
} from '../src/knowledge/repo';

async function main() {
  const dir = process.env.CLAUDE_MEMORY_DIR;
  if (!dir) throw new Error('CLAUDE_MEMORY_DIR não definida');

  const files = (await readdir(dir)).filter((f) => f.endsWith('.md'));
  const docs: KnowledgeDoc[] = [];
  for (const f of files) {
    const doc = parseMemoryFile(f, await readFile(join(dir, f), 'utf8'));
    if (doc) docs.push(doc);
  }

  const plan = planSync(await listClaudeMemorySlugs(), docs);
  for (const doc of plan.upserts) await upsertClaudeMemory(doc);
  await deleteClaudeMemory(plan.deletes);

  console.log(`knowledge: ${plan.upserts.length} upserts, ${plan.deletes.length} removidos`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
