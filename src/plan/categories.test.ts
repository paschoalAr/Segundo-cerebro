import { describe, expect, it } from 'vitest';
import { BLOCK_KINDS, gcalColorId } from './categories';

describe('categorias de bloco', () => {
  it('tem as categorias que o Arthur pediu: trabalho, faculdade (aula/prova/entrega), estudo, pessoal e deslocamento', () => {
    expect([...BLOCK_KINDS]).toEqual(['work', 'class', 'exam', 'assignment', 'study', 'personal', 'travel']);
  });

  it('usa azul no trabalho, verde na aula e rosa no estudo', () => {
    expect(gcalColorId('work')).toBe('7');
    expect(gcalColorId('class')).toBe('10');
    expect(gcalColorId('study')).toBe('4');
  });

  it('separa prova e entrega em cores proprias dentro da faculdade', () => {
    expect(gcalColorId('exam')).toBe('11');
    expect(gcalColorId('assignment')).toBe('6');
    expect(gcalColorId('exam')).not.toBe(gcalColorId('assignment'));
    expect(gcalColorId('exam')).not.toBe(gcalColorId('class'));
  });

  it('da uma cor distinta para cada categoria', () => {
    const cores = BLOCK_KINDS.map(gcalColorId);
    expect(new Set(cores).size).toBe(BLOCK_KINDS.length);
  });
});
