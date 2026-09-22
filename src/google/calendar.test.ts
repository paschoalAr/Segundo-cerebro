import { describe, expect, it } from 'vitest';
import { mapGcalEventToFact, pickCerebroCalendar } from './calendar';

describe('pickCerebroCalendar', () => {
  it('acha o calendário chamado Cérebro', () => {
    const id = pickCerebroCalendar([
      { id: 'a', summary: 'Pessoal' },
      { id: 'b', summary: 'Cérebro' },
    ]);
    expect(id).toBe('b');
  });

  it('retorna null se não existir', () => {
    expect(pickCerebroCalendar([{ id: 'a', summary: 'Pessoal' }])).toBeNull();
  });
});

describe('mapGcalEventToFact', () => {
  it('mapeia evento com hora', () => {
    const fact = mapGcalEventToFact('cal1', {
      id: 'evt1',
      summary: 'Reunião',
      status: 'confirmed',
      start: { dateTime: '2026-09-25T14:00:00-03:00' },
      end: { dateTime: '2026-09-25T15:00:00-03:00' },
    });
    expect(fact).toMatchObject({
      kind: 'event',
      title: 'Reunião',
      source: 'gcal',
      sourceRef: 'evt1',
      allDay: false,
      meta: { calendarId: 'cal1' },
    });
  });

  it('mapeia evento de dia inteiro e usa título padrão quando falta', () => {
    const fact = mapGcalEventToFact('cal1', {
      id: 'evt2',
      status: 'confirmed',
      start: { date: '2026-09-26' },
      end: { date: '2026-09-27' },
    });
    expect(fact.allDay).toBe(true);
    expect(fact.title).toBe('(sem título)');
    // vitest.config.ts fixa TZ=America/Sao_Paulo — meia-noite local, não UTC.
    expect(fact.date.getFullYear()).toBe(2026);
    expect(fact.date.getMonth()).toBe(8);
    expect(fact.date.getDate()).toBe(26);
    expect(fact.date.getHours()).toBe(0);
  });
});
