import { listOpenQuestions } from '@/src/questions/repo';
import { listPendingSuggestions } from '@/src/manual/suggestions-repo';
import { listPendingTaskSuggestions } from '@/src/tasks/suggestions-repo';
import { SECTOR_LABELS } from '@/src/sectors/sector';
import {
  acceptSuggestionAction,
  acceptTaskSuggestionAction,
  answerQuestionAction,
  dismissQuestionAction,
  rejectSuggestionAction,
  rejectTaskSuggestionAction,
} from './actions';

export default async function PendenciasPage() {
  const [questions, suggestions, taskSuggestions] = await Promise.all([
    listOpenQuestions(),
    listPendingSuggestions(),
    listPendingTaskSuggestions(),
  ]);

  return (
    <>
      <h1>Pendências</h1>

      <h2>Perguntas ({questions.length})</h2>
      {questions.length === 0 && <p className="muted">Nenhuma pergunta em aberto.</p>}
      {questions.map((q) => (
        <div key={q.id} className="card">
          <div>{q.text}</div>
          <span className="muted">{q.askedAt.toLocaleString('pt-BR')}</span>
          <form action={answerQuestionAction} className="row" style={{ marginTop: 8 }}>
            <input type="hidden" name="id" value={q.id} />
            <input type="text" name="answer" placeholder="Sua resposta" required />
            <button type="submit">Responder</button>
          </form>
          <form action={dismissQuestionAction} style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={q.id} />
            <button type="submit" className="secondary">Dispensar</button>
          </form>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Sugestões de manual ({suggestions.length})</h2>
      {suggestions.length === 0 && <p className="muted">Nenhuma sugestão pendente.</p>}
      {suggestions.map((s) => (
        <div key={s.id} className="card">
          <div className="muted">{s.section}</div>
          <form action={acceptSuggestionAction}>
            <input type="hidden" name="id" value={s.id} />
            <textarea name="text" defaultValue={s.text} rows={2} />
            <div className="row" style={{ marginTop: 8 }}>
              <button type="submit">Aceitar</button>
            </div>
          </form>
          <form action={rejectSuggestionAction} style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={s.id} />
            <button type="submit" className="secondary">Rejeitar</button>
          </form>
        </div>
      ))}

      <h2 style={{ marginTop: 32 }}>Sugestões de tarefa ({taskSuggestions.length})</h2>
      {taskSuggestions.length === 0 && <p className="muted">Nenhuma sugestão de tarefa pendente.</p>}
      {taskSuggestions.map((t) => (
        <div key={t.id} className="card">
          <div className="muted">
            {t.sector ? SECTOR_LABELS[t.sector] : 'sem setor'}
            {t.due ? ` · prazo ${t.due.toLocaleDateString('pt-BR')}` : ' · sem prazo'}
          </div>
          <form action={acceptTaskSuggestionAction}>
            <input type="hidden" name="id" value={t.id} />
            <input type="text" name="title" defaultValue={t.title} />
            <p className="muted" style={{ marginBottom: 0 }}>{t.reason}</p>
            <div className="row" style={{ marginTop: 8 }}>
              <button type="submit">Aceitar</button>
            </div>
          </form>
          <form action={rejectTaskSuggestionAction} style={{ marginTop: 4 }}>
            <input type="hidden" name="id" value={t.id} />
            <button type="submit" className="secondary">Rejeitar</button>
          </form>
        </div>
      ))}
    </>
  );
}
