import {
  hourRange,
  isSameWeek,
  nowLinePct,
  placeWeek,
  splitItems,
  dayIndex,
  type GridItem,
} from '@/src/semana/grid';

const WEEKDAYS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB', 'DOM'];
const HOUR_PX = 40;

function hhmm(d: Date): string {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function WeekGrid({ weekStart, items, now }: { weekStart: Date; items: GridItem[]; now: Date }) {
  const { allDay, timed } = splitItems(items);
  const range = hourRange(timed);
  const hours = range.endHour - range.startHour;
  const bodyHeight = hours * HOUR_PX;

  const placed = placeWeek(timed, weekStart, range);
  const todayColumn = isSameWeek(weekStart, now) ? dayIndex(now, weekStart) : -1;
  const nowPct = todayColumn === -1 ? null : nowLinePct(now, range);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const allDayByColumn = new Map<number, GridItem[]>();
  for (const item of allDay) {
    const day = dayIndex(item.start, weekStart);
    if (day === -1) continue;
    allDayByColumn.set(day, [...(allDayByColumn.get(day) ?? []), item]);
  }

  return (
    <div className="wk" style={{ ['--wk-hour-px' as string]: `${HOUR_PX}px` }}>
      <div className="wk-head">
        <div className="wk-gutter-cell" />
        {days.map((d, i) => (
          <div key={i} className="wk-head-cell" data-today={i === todayColumn}>
            {WEEKDAYS[i]}
            <span className="wk-head-day">
              {String(d.getDate()).padStart(2, '0')}/{String(d.getMonth() + 1).padStart(2, '0')}
            </span>
          </div>
        ))}
      </div>

      <div className="wk-allday">
        <div className="wk-gutter-cell">dia todo</div>
        {days.map((_, i) => (
          <div key={i} className="wk-allday-cell">
            {(allDayByColumn.get(i) ?? []).map((item) => (
              <span key={item.key} className="wk-chip" data-alert={item.alert} title={item.title}>
                {item.title}
              </span>
            ))}
          </div>
        ))}
      </div>

      <div className="wk-body">
        <div className="wk-hours" style={{ height: bodyHeight }}>
          {Array.from({ length: hours + 1 }, (_, i) => (
            <span key={i} className="wk-hour-label" style={{ top: i * HOUR_PX }}>
              {String(range.startHour + i).padStart(2, '0')}h
            </span>
          ))}
        </div>

        {days.map((d, i) => (
          <div key={i} className="wk-col" data-today={i === todayColumn} style={{ height: bodyHeight }}>
            {placed
              .filter((p) => p.day === i)
              .map((p) => (
                <div
                  key={p.key}
                  className="wk-ev"
                  data-kind={p.kind}
                  data-alert={p.alert}
                  data-status={p.status}
                  style={{
                    top: `${p.topPct}%`,
                    height: `${p.heightPct}%`,
                    left: `calc(${(p.lane / p.lanes) * 100}% + 2px)`,
                    width: `calc(${100 / p.lanes}% - 4px)`,
                  }}
                  title={`${hhmm(p.start)} · ${p.title}`}
                >
                  <span className="wk-ev-time">{hhmm(p.start)}</span>
                  {p.title}
                  {p.tag ? <span className="wk-ev-tag">{p.tag}</span> : null}
                </div>
              ))}

            {i === todayColumn && nowPct !== null && (
              <div className="wk-now" style={{ top: `${nowPct}%` }} aria-label={`agora, ${hhmm(now)}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
