import { syncFactsForSource } from './repo';
import { fetchGcalFacts } from '@/src/sources/gcal';
import { fetchMoodleFacts } from '@/src/sources/moodle';
import { fetchOutlookFacts } from '@/src/sources/outlook';

export type CollectResult = {
  ok: boolean;
  bySource: Partial<Record<'gcal' | 'moodle' | 'outlook', { upserts: number; deletes: number }>>;
  error?: string;
  warning?: string;
};

export async function collectAll(): Promise<CollectResult> {
  const bySource: CollectResult['bySource'] = {};

  try {
    // Proposital: gcal e moodle são obrigatórios (spec §4.1 — "não planeja com metade do
    // mundo"). Promise.all faz os dois falharem juntos se qualquer um der erro; não trocar
    // por allSettled sem entender que isso reabriria o risco de sincronizar só uma fonte
    // que syncFactsForSource já avisa pra nunca deixar acontecer (ver repo.ts).
    // Nota: se o sync do gcal já tiver gravado e o do moodle falhar depois, ok:false aqui
    // não significa "nada foi persistido" — só que o moodle não sincronizou.
    const [gcalFacts, moodleFacts] = await Promise.all([fetchGcalFacts(), fetchMoodleFacts()]);
    bySource.gcal = await syncFactsForSource('gcal', gcalFacts);
    bySource.moodle = await syncFactsForSource('moodle', moodleFacts);
  } catch (e) {
    return { ok: false, bySource, error: e instanceof Error ? e.message : String(e) };
  }

  let warning: string | undefined;
  try {
    const outlookFacts = await fetchOutlookFacts();
    bySource.outlook = await syncFactsForSource('outlook', outlookFacts);
  } catch (e) {
    warning = `Outlook falhou (ignorado): ${e instanceof Error ? e.message : String(e)}`;
  }

  return { ok: true, bySource, warning };
}
