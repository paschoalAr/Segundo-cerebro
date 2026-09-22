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
