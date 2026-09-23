import { getValidAccessToken } from '@/src/google/token';
import { deleteEvent, insertEvent, patchEvent, toGCalEventTime } from '@/src/google/calendar';
import { gcalColorId } from './categories';
import { sanitizeFactId } from './fact-ref';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { deleteBlockRow, getBlock, insertBlockDraft, setBlockGcalEventId, updateBlock } from './blocks-repo';
import { insertFact, listAllFactIds } from '@/src/facts/repo';
import { markInboxIgnored, markInboxProcessed } from '@/src/inbox/repo';
import { createQuestion } from '@/src/questions/repo';
import { createSuggestion } from '@/src/manual/suggestions-repo';
import { MANUAL_SECTIONS } from '@/src/manual/sections';
import type { PlanOutput } from './schema';

export type ApplySummary = {
  blocksCreated: number;
  blocksUpdated: number;
  blocksDeleted: number;
  questionsCreated: number;
  suggestionsCreated: number;
};

export async function applyPlanOutput(output: PlanOutput, runId: number): Promise<ApplySummary> {
  const accessToken = await getValidAccessToken();
  const cerebroId = await getCerebroCalendarId(accessToken);

  // 1. Inbox: vira fact, pergunta, ou é ignorado — sempre marca o item como processado.
  for (const item of output.inbox) {
    const interp = item.interpretation;
    if (interp.type === 'fact') {
      const factId = await insertFact({
        kind: interp.kind,
        title: interp.title,
        date: new Date(interp.date),
        endDate: interp.end_date ? new Date(interp.end_date) : null,
        allDay: interp.all_day,
        source: 'inbox',
        sourceRef: `inbox-${item.id}`,
        meta: {},
      });
      await markInboxProcessed(item.id, { factIds: [factId] });
    } else if (interp.type === 'question') {
      const questionId = await createQuestion(interp.text, { fromInboxId: item.id }, runId);
      await markInboxProcessed(item.id, { questionIds: [questionId] });
    } else {
      await markInboxIgnored(item.id, interp.why);
    }
  }

  // 2. Blocos: deletes → updates → creates (spec §4.5), cada escrita no Google Calendar tolerante a 404.
  for (const del of output.blocks.delete) {
    const block = await getBlock(del.id);
    if (block?.gcalEventId) await deleteEvent(accessToken, cerebroId, block.gcalEventId);
    await deleteBlockRow(del.id);
  }

  for (const upd of output.blocks.update) {
    const block = await getBlock(upd.id);
    if (!block) continue;
    if (block.gcalEventId) {
      await patchEvent(accessToken, cerebroId, block.gcalEventId, {
        summary: upd.title,
        start: toGCalEventTime(new Date(upd.start)),
        end: toGCalEventTime(new Date(upd.end)),
        colorId: gcalColorId(block.kind),
      });
    }
    await updateBlock(upd.id, { title: upd.title, start: new Date(upd.start), end: new Date(upd.end), reason: upd.reason }, runId);
  }

  // Depois da etapa 1, que já inseriu os fatos vindos da inbox — assim um fact_id legítimo
  // criado neste mesmo run também é aceito.
  const factIds = await listAllFactIds();

  for (const create of output.blocks.create) {
    const id = await insertBlockDraft(
      {
        title: create.title,
        start: new Date(create.start),
        end: new Date(create.end),
        kind: create.kind,
        factId: sanitizeFactId(create.fact_id, factIds),
        reason: create.reason,
      },
      runId,
    );
    const eventId = await insertEvent(accessToken, cerebroId, {
      summary: create.title,
      start: toGCalEventTime(new Date(create.start)),
      end: toGCalEventTime(new Date(create.end)),
      blockId: id,
      colorId: gcalColorId(create.kind),
    });
    await setBlockGcalEventId(id, eventId);
  }

  // 3. Perguntas novas.
  for (const q of output.questions) {
    await createQuestion(q.text, q.context, runId);
  }

  // 4. Sugestões de manual — seção inválida (a Claude alucinou) cai em "Regras de planejamento" em vez de quebrar o run.
  for (const s of output.manual_suggestions) {
    const section = (MANUAL_SECTIONS as readonly string[]).includes(s.section) ? s.section : 'Regras de planejamento';
    await createSuggestion(section, s.text, s.from_question_id, runId);
  }

  return {
    blocksCreated: output.blocks.create.length,
    blocksUpdated: output.blocks.update.length,
    blocksDeleted: output.blocks.delete.length,
    questionsCreated: output.questions.length,
    suggestionsCreated: output.manual_suggestions.length,
  };
}
