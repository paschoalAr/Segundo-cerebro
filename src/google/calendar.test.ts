import { afterEach, describe, expect, it, vi } from 'vitest';
import { insertEvent, mapGcalEventToFact, patchEvent, pickCerebroCalendar } from './calendar';

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

describe('cor do evento no Cérebro', () => {
  function captureFetch(): { body: () => Record<string, unknown> } {
    let captured: Record<string, unknown> = {};
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      captured = JSON.parse(init.body) as Record<string, unknown>;
      return { ok: true, status: 200, json: async () => ({ id: 'evt-novo' }) } as unknown as Response;
    });
    return { body: () => captured };
  }

  afterEach(() => vi.unstubAllGlobals());

  it('manda o colorId da categoria ao criar o evento', async () => {
    const f = captureFetch();
    await insertEvent('token', 'cal1', {
      summary: 'Estudar Segurança',
      start: { dateTime: '2026-09-26T09:00:00-03:00' },
      end: { dateTime: '2026-09-26T11:00:00-03:00' },
      blockId: 7,
      colorId: '4',
    });
    expect(f.body().colorId).toBe('4');
  });

  it('atualiza a cor quando a categoria do bloco muda', async () => {
    const f = captureFetch();
    await patchEvent('token', 'cal1', 'evt1', {
      summary: 'Prova de SisDist',
      start: { dateTime: '2026-10-07T17:30:00-03:00' },
      end: { dateTime: '2026-10-07T19:00:00-03:00' },
      colorId: '11',
    });
    expect(f.body().colorId).toBe('11');
  });
});
