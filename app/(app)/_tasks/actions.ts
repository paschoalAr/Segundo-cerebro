'use server';

import { revalidatePath } from 'next/cache';
import { completeTask, createTask, dropTask } from '@/src/tasks/repo';
import { isSector } from '@/src/sectors/sector';
import { getValidAccessToken } from '@/src/google/token';
import { getCerebroCalendarId } from '@/src/google/cerebro-calendar';
import { insertEvent, toGCalEventTime } from '@/src/google/calendar';
import { insertBlockDraft, setBlockGcalEventId, deleteBlockRow } from '@/src/plan/blocks-repo';
import { gcalColorId, BLOCK_KINDS, type BlockKind } from '@/src/plan/categories';
import { deriveBlockSector } from '@/src/sectors/derive';
import { getTask } from '@/src/tasks/repo';
import { parseBlockRange } from '@/src/tasks/task';

function revalidateTaskScreens() {
  revalidatePath('/semana');
  revalidatePath('/setor/[slug]', 'page');
  revalidatePath('/');
}

export async function createTaskAction(formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;

  const rawSector = String(formData.get('sector') ?? '');
  const rawDue = String(formData.get('due') ?? '').trim();

  await createTask({
    title,
    sector: isSector(rawSector) ? rawSector : null,
    // input type="date" entrega 'YYYY-MM-DD'; sem hora o prazo é o fim daquele dia.
    due: /^\d{4}-\d{2}-\d{2}$/.test(rawDue) ? new Date(`${rawDue}T23:59:59`) : null,
    origin: 'manual',
  });

  revalidateTaskScreens();
}

export async function completeTaskAction(formData: FormData) {
  await completeTask(Number(formData.get('id')));
  revalidateTaskScreens();
}

export async function dropTaskAction(formData: FormData) {
  await dropTask(Number(formData.get('id')));
  revalidateTaskScreens();
}

/**
 * Reserva horário pra uma tarefa: cria um `plan_block` normal, com evento no calendário
 * "Cérebro", apontando de volta pra tarefa. A tarefa **continua aberta** — o bloco é o
 * tempo reservado, não a conclusão; quem fecha a tarefa é o Arthur clicando em "concluir".
 */
export async function taskToBlockAction(formData: FormData) {
  const id = Number(formData.get('id'));
  const task = await getTask(id);
  if (!task || task.status !== 'open') return;

  const range = parseBlockRange(String(formData.get('start') ?? ''), String(formData.get('duration') ?? ''));
  if (!range.ok) return;

  const rawKind = String(formData.get('kind') ?? 'study');
  const kind: BlockKind = (BLOCK_KINDS as readonly string[]).includes(rawKind) ? (rawKind as BlockKind) : 'study';

  const blockId = await insertBlockDraft(
    {
      title: task.title,
      start: range.start,
      end: range.end,
      kind,
      sector: task.sector ?? deriveBlockSector(kind),
      factId: null,
      taskId: task.id,
      reason: `tempo reservado pra tarefa #${task.id}`,
    },
    null,
  );

  try {
    const accessToken = await getValidAccessToken();
    const cerebroId = await getCerebroCalendarId(accessToken);
    const eventId = await insertEvent(accessToken, cerebroId, {
      summary: task.title,
      start: toGCalEventTime(range.start),
      end: toGCalEventTime(range.end),
      blockId,
      colorId: gcalColorId(kind),
    });
    await setBlockGcalEventId(blockId, eventId);
  } catch (err) {
    await deleteBlockRow(blockId);
    throw err;
  }

  revalidateTaskScreens();
}
