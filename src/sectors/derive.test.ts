import { describe, expect, it } from 'vitest';
import { deriveBlockSector, deriveFactSector, parseCalendarSectorMap } from './derive';

describe('parseCalendarSectorMap', () => {
  it('lê um JSON de calendário para setor', () => {
    expect(parseCalendarSectorMap('{"pessoal@gmail.com":"pessoal","x@group.calendar.google.com":"carreira"}')).toEqual({
      'pessoal@gmail.com': 'pessoal',
      'x@group.calendar.google.com': 'carreira',
    });
  });

  it('devolve mapa vazio quando a variável não existe ou está vazia', () => {
    expect(parseCalendarSectorMap(undefined)).toEqual({});
    expect(parseCalendarSectorMap('')).toEqual({});
    expect(parseCalendarSectorMap('   ')).toEqual({});
  });

  it('não quebra o app com JSON inválido — ignora e segue sem mapa', () => {
    expect(parseCalendarSectorMap('{isso nao e json')).toEqual({});
    expect(parseCalendarSectorMap('"uma string"')).toEqual({});
    expect(parseCalendarSectorMap('[1,2,3]')).toEqual({});
  });

  it('descarta entrada cujo valor não é um setor válido', () => {
    expect(parseCalendarSectorMap('{"a@x":"faculdade","b@x":"saude"}')).toEqual({ 'b@x': 'saude' });
  });
});

describe('deriveFactSector', () => {
  it('moodle é sempre estudos', () => {
    expect(deriveFactSector({ source: 'moodle', meta: {} })).toBe('estudos');
  });

  it('outlook é sempre carreira — é a caixa da Galapos', () => {
    expect(deriveFactSector({ source: 'outlook', meta: {} })).toBe('carreira');
  });

  it('gcal sai do mapa de calendários', () => {
    const map = { 'pessoal@gmail.com': 'pessoal' } as const;
    expect(deriveFactSector({ source: 'gcal', meta: { calendarId: 'pessoal@gmail.com' } }, map)).toBe('pessoal');
  });

  it('gcal de calendário não mapeado fica sem setor em vez de chutar', () => {
    expect(deriveFactSector({ source: 'gcal', meta: { calendarId: 'outro@x' } }, { 'a@x': 'saude' })).toBeNull();
    expect(deriveFactSector({ source: 'gcal', meta: {} })).toBeNull();
    expect(deriveFactSector({ source: 'gcal', meta: { calendarId: 42 } })).toBeNull();
  });

  it('inbox fica sem setor — texto solto não diz de qual área da vida é', () => {
    expect(deriveFactSector({ source: 'inbox', meta: {} })).toBeNull();
  });
});

describe('deriveBlockSector', () => {
  it('tudo que é faculdade cai em estudos', () => {
    for (const kind of ['study', 'class', 'exam', 'assignment'] as const) {
      expect(deriveBlockSector(kind), kind).toBe('estudos');
    }
  });

  it('work é carreira e personal é pessoal', () => {
    expect(deriveBlockSector('work')).toBe('carreira');
    expect(deriveBlockSector('personal')).toBe('pessoal');
  });

  it('travel fica sem setor — deslocamento não é de ninguém até saber o destino', () => {
    expect(deriveBlockSector('travel')).toBeNull();
  });

  it('o setor do fato ligado vence a categoria', () => {
    expect(deriveBlockSector('travel', 'carreira')).toBe('carreira');
    expect(deriveBlockSector('study', 'projetos')).toBe('projetos');
  });

  it('fato sem setor não apaga o palpite da categoria', () => {
    expect(deriveBlockSector('study', null)).toBe('estudos');
  });
});
