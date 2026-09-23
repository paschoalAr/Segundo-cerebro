import { z } from 'zod';
import { runClaudeCli } from '@/src/motor/run-claude-cli';
import { collectAll } from '@/src/facts/collect';
import { getManual } from '@/src/manual/repo';
import { listKnowledgeFull } from '@/src/knowledge/repo';
import { listFactsInRange } from '@/src/facts/repo';
import { listBlocksInRange } from './blocks-repo';
import { fetchObservations } from './observations';
import { listNewInboxItems } from '@/src/inbox/repo';
import { listAnsweredSince } from '@/src/questions/repo';
import { createRun, finishRun, findLastRun, reapStaleRuns } from '@/src/runs/repo';
import { getCollectionWindow } from '@/src/facts/window';
import { buildSystemPrompt, buildUserContent } from './prompt';
import { PlanOutputSchema } from './schema';
import { applyPlanOutput } from './apply';

function getPromptWindow(): { start: Date; end: Date } {
  const start = new Date();
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  const { end } = getCollectionWindow();
  return { start, end };
}

export async function runPlanEngine(trigger: 'cron' | 'manual'): Promise<number> {
  // Sem check-then-act: `createRun` lança RunLockedError se já houver run em voo, e quem
  // decide isso é o índice único do banco — dois processos simultâneos não passam os dois.
  await reapStaleRuns();
  const runId = await createRun(trigger);

  try {
    const collected = await collectAll();
    if (!collected.ok) throw new Error(collected.error ?? 'Falha ao coletar fontes');

    const { start, end } = getPromptWindow();
    const lastRun = await findLastRun();
    const since = lastRun?.startedAt ?? new Date(0);

    const [manual, knowledge, facts, blocks, observations, inboxItems, answered] = await Promise.all([
      getManual(),
      listKnowledgeFull(),
      listFactsInRange(start, end),
      listBlocksInRange(start, end),
      fetchObservations(),
      listNewInboxItems(),
      listAnsweredSince(since),
    ]);

    const today = new Date();
    const systemBlocks = buildSystemPrompt();
    const userBlocks = buildUserContent({
      manual: manual.content,
      knowledge,
      today,
      weekStart: start,
      weekEnd: end,
      facts,
      blocks,
      observations,
      inboxItems,
      answeredQuestions: answered,
    });

    // cache_control em buildSystemPrompt/buildUserContent é pra API da Anthropic — o
    // Claude Code local gerencia cache próprio, então só concatenamos o texto aqui.
    const systemPrompt = systemBlocks.map((b) => b.text).join('\n\n');
    const userPrompt = userBlocks.map((b) => b.text).join('\n\n');
    const jsonSchema = z.toJSONSchema(PlanOutputSchema) as Record<string, unknown>;

    const cliResult = await runClaudeCli({
      systemPrompt,
      userPrompt,
      jsonSchema,
      model: process.env.MOTOR_MODEL ?? 'opus',
    });

    const output = PlanOutputSchema.parse(cliResult.structuredOutput);

    await applyPlanOutput(output, runId);

    const conflictsSummary = output.conflicts.length
      ? `\n\nConflitos:\n${output.conflicts.map((c) => `- [${c.severity}] ${c.text}`).join('\n')}`
      : '';

    await finishRun(runId, {
      status: 'ok',
      inputTokens: cliResult.usage.inputTokens,
      cacheReadTokens: cliResult.usage.cacheReadInputTokens,
      outputTokens: cliResult.usage.outputTokens,
      summary: output.summary + conflictsSummary,
      conflicts: output.conflicts,
    });

    return runId;
  } catch (e) {
    await finishRun(runId, { status: 'error', error: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
