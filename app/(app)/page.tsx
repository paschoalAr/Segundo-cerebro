import { eq } from 'drizzle-orm';
import { db } from '@/src/db';
import { sourcesCache } from '@/src/db/schema';
import { listFactsInRange } from '@/src/facts/repo';
import type { CollectResult } from '@/src/facts/collect';
import { addWeeks, formatWeekLabel, getWeekRange } from '@/src/facts/week';
import { refreshFacts } from './actions';

const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default async function SemanaPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>;
}) {
  const { w } = await searchParams;
  const offset = w ? Number(w) : 0;
  const base = addWeeks(new Date(), Number.isFinite(offset) ? offset : 0);
  const { start, end } = getWeekRange(base);

  const [items, statusRow] = await Promise.all([
    listFactsInRange(start, end),
    db.query.sourcesCache.findFirst({ where: eq(sourcesCache.source, 'collect_status') }),
  ]);
  const status = statusRow?.payload as CollectResult | undefined;

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });

  const byDay = new Map<string, typeof items>();
  for (const item of items) {
    const key = dayKey(item.date);
    byDay.set(key, [...(byDay.get(key) ?? []), item]);
  }

  return (
    <>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h1>Semana</h1>
        <form action={refreshFacts}>
          <button type="submit">Atualizar fontes</button>
        </form>
      </div>

      {status?.error && <p className="card">Último run falhou: {status.error}</p>}
      {status?.warning && <p className="muted">{status.warning}</p>}

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <a href={`/?w=${offset - 1}`}>&larr; anterior</a>
        <strong>{formatWeekLabel(start, end)}</strong>
        <a href={`/?w=${offset + 1}`}>próxima &rarr;</a>
      </div>

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
            {dayItems.map((item) => (
              <div key={item.id} className="row" style={{ gap: 8 }}>
                <span style={{ color: 'var(--block-real)' }}>●</span>
                <span>
                  {item.allDay ? '' : `${item.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} · `}
                  {item.title}
                </span>
                <span className="muted">({item.source})</span>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
