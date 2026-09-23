import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { listFactsInRange } from '@/src/facts/repo';
import type { CollectResult } from '@/src/facts/collect';
import { listBlocksInRange } from '@/src/plan/blocks-repo';
import { findLastRun } from '@/src/runs/repo';
import { addWeeks, formatWeekLabel, getWeekRange } from '@/src/facts/week';
import { markBlockDone, markBlockSkipped, refreshFacts } from './actions';
import type { GridItem } from '@/src/semana/grid';
import { WeekGrid } from './week-grid';
import { listOpenTasks } from '@/src/tasks/repo';
import { TasksPanel } from '../_tasks/panel';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Item =
  | { kind: 'fact'; id: number; date: Date; allDay: boolean; title: string; source: string }
  | { kind: 'block'; id: number; date: Date; allDay: boolean; title: string; blockKind: string; status: string; reason: string };

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const rawOffset = w ? Number(w) : 0;
  // ~10 anos pra cada lado — evita ?w= absurdo virar Invalid Date em addWeeks/getWeekRange.
  const offset = Number.isFinite(rawOffset) ? Math.max(-520, Math.min(520, rawOffset)) : 0;
  const base = addWeeks(new Date(), offset);
  const { start, end } = getWeekRange(base);

  const [facts, blocks, statusRow, lastRun, openTasks] = await Promise.all([
    listFactsInRange(start, end),
    listBlocksInRange(start, end),
    db.query.sourcesCache.findFirst({ where: eq(sourcesCache.source, 'collect_status') }),
    findLastRun(),
    listOpenTasks(),
  ]);
  const status = statusRow?.payload as CollectResult | undefined;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const items: Item[] = [
    ...facts.map((f): Item => ({ kind: 'fact', id: f.id, date: f.date, allDay: f.allDay, title: f.title, source: f.source })),
    ...blocks.map((b): Item => ({
      kind: 'block',
      id: b.id,
      date: b.start,
      allDay: false,
      title: b.title,
      blockKind: b.kind,
      status: b.status,
      reason: b.reason,
    })),
  ];

  const now = new Date();

  const gridItems: GridItem[] = [
    ...facts.map((f): GridItem => ({
      key: `fact-${f.id}`,
      kind: 'fact',
      title: f.title,
      start: f.date,
      end: f.endDate,
      allDay: f.allDay,
      alert: f.kind === 'deadline',
      factKind: f.kind,
      tag: f.source,
    })),
    ...blocks.map((b): GridItem => ({
      key: `block-${b.id}`,
      kind: 'block',
      title: b.title,
      start: b.start,
      end: b.end,
      allDay: false,
      alert: b.kind === 'exam' || b.kind === 'assignment',
      blockKind: b.kind,
      status: b.status,
      tag: b.kind,
    })),
  ];

  const byDay = new Map<string, Item[]>();
  for (const item of items) {
    const key = dayKey(item.date);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  const conflicts = (lastRun?.conflicts ?? []) as { text: string; severity: 'info' | 'warn' }[];

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Semana</h1>
        <form action={refreshFacts}>
          <button type="submit" className="secondary">Atualizar fontes</button>
        </form>
      </div>

      {status?.error && <p className="card">Última coleta falhou: {status.error}</p>}
      {status?.warning && <p className="muted">{status.warning}</p>}

      {lastRun && (
        <p className="muted">
          Último planejamento: {lastRun.startedAt.toLocaleString('pt-BR')} · {lastRun.trigger} · {lastRun.status}
          {lastRun.summary ? ` · ${lastRun.summary.split('\n')[0]}` : ''}
          {' · roda automaticamente ao logar no Windows, ou na mão com scripts/run-plan-local.ts'}
        </p>
      )}
      {lastRun?.error && <p className="card">Último planejamento falhou: {lastRun.error}</p>}
      {conflicts.map((c, i) => (
        <p key={i} className="card">
          {c.severity === 'warn' ? '⚠️ ' : ''}
          {c.text}
        </p>
      ))}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <a href={`/semana?w=${offset - 1}`}>&larr; anterior</a>
        <strong>{formatWeekLabel(start, end)}</strong>
        <a href={`/semana?w=${offset + 1}`}>próxima &rarr;</a>
      </div>

      <TasksPanel tasks={openTasks} now={new Date()} />

      <WeekGrid weekStart={start} items={gridItems} now={now} />

      <h2 className="wk-list-title">Detalhes do dia</h2>

      {days.map((d) => {
        const key = dayKey(d);
        const dayItems = byDay.get(key) ?? [];
        return (
          <div key={key} className="card">
            <strong>
              {WEEKDAYS[(d.getDay() + 6) % 7]} · {String(d.getDate()).padStart(2, '0')}/
              {String(d.getMonth() + 1).padStart(2, '0')}
            </strong>
            {dayItems.length === 0 && <p className="muted">Nada.</p>}
            {dayItems.map((item) =>
              item.kind === 'fact' ? (
                <div key={`fact-${item.id}`} className="row" style={{ gap: 8 }}>
                  <span style={{ color: 'var(--txt-dim)' }}>●</span>
                  <span>
                    {item.allDay ? '' : `${item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · `}
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
        );
      })}
    </>
  );
}
