import { notFound } from 'next/navigation';
import { isSector, SECTOR_LABELS } from '@/src/sectors/sector';
import { listSectorAgenda } from '@/src/sectors/repo';
import { getCollectionWindow } from '@/src/facts/window';
import { markBlockDone, markBlockSkipped } from '../../semana/actions';
import { listOpenTasksBySector } from '@/src/tasks/repo';
import { TasksPanel } from '../../_tasks/panel';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(d: Date): string {
  return `${WEEKDAYS[(d.getDay() + 6) % 7]} · ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

type Item =
  | { kind: 'fact'; id: number; date: Date; allDay: boolean; title: string; source: string }
  | { kind: 'block'; id: number; date: Date; title: string; status: string; reason: string };

export default async function SetorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isSector(slug)) notFound();

  const now = new Date();
  const { end } = getCollectionWindow(now);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const [agenda, sectorTasks] = await Promise.all([
    listSectorAgenda(slug, start, end),
    listOpenTasksBySector(slug),
  ]);

  const items: Item[] = [
    ...agenda.facts.map((f): Item => ({
      kind: 'fact',
      id: f.id,
      date: f.date,
      allDay: f.allDay,
      title: f.title,
      source: f.source,
    })),
    ...agenda.blocks.map((b): Item => ({
      kind: 'block',
      id: b.id,
      date: b.start,
      title: b.title,
      status: b.status,
      reason: b.reason,
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  const byDay = new Map<string, Item[]>();
  for (const item of items) {
    const key = dayKey(item.date);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return (
    <>
      <h1>{SECTOR_LABELS[slug]}</h1>

      <TasksPanel tasks={sectorTasks} now={now} fixedSector={slug} />

      {items.length === 0 ? (
        <p className="muted">
          Nada deste setor nos próximos 21 dias. Fatos do Google Calendar só entram num setor se o calendário estiver no{' '}
          <code>SECTOR_CALENDAR_MAP</code>.
        </p>
      ) : (
        <p className="muted">
          {agenda.facts.length} fato(s) e {agenda.blocks.length} bloco(s) até {end.toLocaleDateString('pt-BR')}.
        </p>
      )}

      {[...byDay.entries()].map(([key, dayItems]) => (
        <div key={key} className="card">
          <strong>{dayLabel(dayItems[0].date)}</strong>
          {dayItems.map((item) =>
            item.kind === 'fact' ? (
              <div key={`fact-${item.id}`} className="row" style={{ gap: 8 }}>
                <span style={{ color: 'var(--txt-dim)' }}>●</span>
                <span>
                  {item.allDay
                    ? ''
                    : `${item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · `}
                  {item.title}
                </span>
                <span className="muted">({item.source})</span>
              </div>
            ) : (
              <div key={`block-${item.id}`} className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                <span style={{ color: 'var(--bat)' }}>●</span>
                <div style={{ flex: 1 }}>
                  <div>
                    {item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · {item.title}{' '}
                    <span className="muted">({item.status})</span>
                  </div>
                  <div className="muted">{item.reason}</div>
                  {item.status === 'planned' && (
                    <div className="row" style={{ gap: 4, marginTop: 4 }}>
                      <form action={markBlockDone}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="secondary">feito</button>
                      </form>
                      <form action={markBlockSkipped}>
                        <input type="hidden" name="id" value={item.id} />
                        <button type="submit" className="secondary">não feito</button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      ))}
    </>
  );
}
