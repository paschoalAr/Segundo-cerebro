import { describe, expect, it } from 'vitest';
import { NAV_ITEMS } from './items';
import { cutFlags, indexOfPath, slotsAround, wrapIndex } from './wheel';

describe('wrapIndex', () => {
  it('fecha o círculo para frente', () => {
    expect(wrapIndex(10, 10)).toBe(0);
    expect(wrapIndex(11, 10)).toBe(1);
  });

  it('fecha o círculo para trás, inclusive com offset bem negativo', () => {
    expect(wrapIndex(-1, 10)).toBe(9);
    expect(wrapIndex(-11, 10)).toBe(9);
    expect(wrapIndex(-25, 10)).toBe(5);
  });
});

describe('slotsAround', () => {
  it('slotsAround(0) atravessa a fronteira do array — Manual e Pendências nas pontas', () => {
    const slots = slotsAround(0);
    expect(slots).toHaveLength(5);
    expect(slots[0].item.label).toBe('Pendências');
    expect(slots[0].emphasis).toBe('far');
    expect(slots[1].item.label).toBe('Manual');
    expect(slots[1].emphasis).toBe('near');
    expect(slots[2].item.label).toBe('Estudos');
    expect(slots[2].emphasis).toBe('active');
    expect(slots[4].item.label).toBe('Finanças');
    expect(slots[4].emphasis).toBe('far');
  });
});

describe('cutFlags', () => {
  it('acende a fronteira Pessoal/Semana quando Pessoal está ativo', () => {
    // Pessoal é o índice 5. Janela: Saúde, Projetos, Pessoal, Semana, Inbox.
    const flags = cutFlags(5);
    expect(flags).toEqual([false, false, true, false]);
  });

  it('acende a fronteira Manual/Estudos quando Estudos está ativo — o erro fácil de esquecer', () => {
    // Estudos é o índice 0. Janela: Pendências, Manual, Estudos, Carreira, Finanças.
    const flags = cutFlags(0);
    expect(flags).toEqual([false, true, false, false]);
  });
});

describe('indexOfPath', () => {
  it('acha Semana', () => {
    expect(indexOfPath('/semana')).toBe(NAV_ITEMS.findIndex((i) => i.slug === 'semana'));
  });

  it('acha Estudos por /setor/estudos', () => {
    expect(indexOfPath('/setor/estudos')).toBe(NAV_ITEMS.findIndex((i) => i.slug === 'estudos'));
  });

  it('/ devolve null', () => {
    expect(indexOfPath('/')).toBeNull();
  });

  it('continua achando Pendências com query string', () => {
    expect(indexOfPath('/pendencias?x=1')).toBe(NAV_ITEMS.findIndex((i) => i.slug === 'pendencias'));
  });
});
