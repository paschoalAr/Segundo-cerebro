import { SECTORS, SECTOR_LABELS, type Sector } from '@/src/sectors/sector';
import { groupTasksByUrgencyBucket, taskUrgency } from '@/src/tasks/task';
import { BLOCK_KINDS } from '@/src/plan/categories';
import { completeTaskAction, createTaskAction, dropTaskAction, taskToBlockAction } from './actions';

export type PanelTask = {
  id: number;
  title: string;
  sector: Sector | null;
  due: Date | null;
  origin: 'manual' | 'motor';
  createdAt: Date;
};

const URGENCY_LABEL: Record<string, string> = {
  overdue: 'atrasada',
  today: 'hoje',
  soon: 'em breve',
  later: '',
  none: '',
};

/** `fixedSector` fixa o setor das tarefas criadas aqui (tela de setor) e some com o seletor. */
export function TasksPanel({
  tasks,
  now,
  fixedSector,
}: {
  tasks: PanelTask[];
  now: Date;
  fixedSector?: Sector;
}) {
  const { atrasadas, estaSemana, semPrazo } = groupTasksByUrgencyBucket(tasks, now);
  const total = atrasadas.length + estaSemana.length + semPrazo.length;

  function renderTaskCard(t: PanelTask) {
    const urgency = taskUrgency(t, now);
    return (
      <div key={t.id} className="card task-item" data-urgency={urgency}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <span>{t.title}</span>
          <span className="muted task-meta">
            {t.sector ? SECTOR_LABELS[t.sector] : 'sem setor'}
            {t.due ? ` · ${t.due.toLocaleDateString('pt-BR')}` : ''}
            {URGENCY_LABEL[urgency] ? ` · ${URGENCY_LABEL[urgency]}` : ''}
            {t.origin === 'motor' ? ' · do motor' : ''}
          </span>
        </div>

        <div className="row" style={{ gap: 4, marginTop: 6 }}>
          <form action={completeTaskAction}>
            <input type="hidden" name="id" value={t.id} />
            <button type="submit" className="secondary">concluir</button>
          </form>
          <form action={dropTaskAction}>
            <input type="hidden" name="id" value={t.id} />
            <button type="submit" className="secondary">largar</button>
          </form>
        </div>

        <details className="task-toblock">
          <summary>virar bloco</summary>
          <form action={taskToBlockAction} className="row" style={{ marginTop: 6 }}>
            <input type="hidden" name="id" value={t.id} />
            <input type="datetime-local" name="start" required className="task-select" aria-label="Início" />
            <input
              type="number"
              name="duration"
              defaultValue={60}
              min={15}
              max={480}
              step={15}
              className="task-select"
              aria-label="Duração em minutos"
            />
            <select name="kind" defaultValue="study" className="task-select" aria-label="Categoria">
              {BLOCK_KINDS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
            <button type="submit" className="secondary">criar bloco</button>
          </form>
        </details>
      </div>
    );
  }

  return (
    <section className="task-panel" aria-label="Tarefas abertas">
      <h2 className="task-panel-title">Tarefas ({total})</h2>

      <form action={createTaskAction} className="row task-new">
        <input type="text" name="title" placeholder="Nova tarefa" required style={{ flex: '2 1 200px' }} />
        {fixedSector ? (
          <input type="hidden" name="sector" value={fixedSector} />
        ) : (
          <select name="sector" defaultValue="" className="task-select">
            <option value="">sem setor</option>
            {SECTORS.map((s) => (
              <option key={s} value={s}>
                {SECTOR_LABELS[s]}
              </option>
            ))}
          </select>
        )}
        <input type="date" name="due" className="task-select" aria-label="Prazo (opcional)" />
        <button type="submit">Criar</button>
      </form>

      {total === 0 && <p className="muted">Nenhuma tarefa aberta.</p>}

      {atrasadas.length > 0 && (
        <>
          <h3 className="wk-list-title">Atrasadas</h3>
          {atrasadas.map(renderTaskCard)}
        </>
      )}

      {estaSemana.length > 0 && (
        <>
          <h3 className="wk-list-title">Esta semana</h3>
          {estaSemana.map(renderTaskCard)}
        </>
      )}

      {semPrazo.length > 0 && (
        <>
          <h3 className="wk-list-title">Sem prazo</h3>
          {semPrazo.map(renderTaskCard)}
        </>
      )}
    </section>
  );
}
