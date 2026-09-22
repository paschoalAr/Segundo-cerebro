import { describe, expect, it } from 'vitest';
import { computeObservations } from './observations';

describe('computeObservations', () => {
  it('sem diferença, não gera observação', () => {
    const start = new Date(2026, 8, 25, 14, 0);
    const obs = computeObservations(
      [{ id: 1, title: 'Estudar Redes', start, gcalEventId: 'evt1' }],
      [{ id: 'evt1', summary: 'Estudar Redes', start: { dateTime: start.toISOString() }, extendedProperties: { private: { block_id: '1' } } }],
    );
    expect(obs).toEqual([]);
  });

  it('bloco sem evento correspondente no Cérebro vira "Arthur removeu"', () => {
    const start = new Date(2026, 8, 25, 14, 0);
    const obs = computeObservations(
      [{ id: 1, title: 'Estudar Redes', start, gcalEventId: 'evt1' }],
      [],
    );
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatch(/removeu/);
    expect(obs[0]).toContain('Estudar Redes');
  });

  it('evento com horário diferente do bloco vira observação de mudança', () => {
    const blockStart = new Date(2026, 8, 25, 14, 0);
    const movedStart = new Date(2026, 8, 25, 18, 0);
    const obs = computeObservations(
      [{ id: 1, title: 'Estudar Redes', start: blockStart, gcalEventId: 'evt1' }],
      [{ id: 'evt1', summary: 'Estudar Redes', start: { dateTime: movedStart.toISOString() }, extendedProperties: { private: { block_id: '1' } } }],
    );
    expect(obs).toHaveLength(1);
    expect(obs[0]).toMatch(/moveu|editou/);
  });

  it('bloco sem gcalEventId é ignorado (nunca foi escrito no Cérebro)', () => {
    const obs = computeObservations([{ id: 2, title: 'x', start: new Date(), gcalEventId: null }], []);
    expect(obs).toEqual([]);
  });
});
