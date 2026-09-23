import { describe, expect, it } from 'vitest';
import { RunLockedError, STALE_RUN_MS, isUniqueViolation } from './lock';

describe('isUniqueViolation', () => {
  it('reconhece o SQLSTATE 23505 direto no erro', () => {
    const e = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(isUniqueViolation(e)).toBe(true);
  });

  it('reconhece 23505 embrulhado em cause (driver da Neon)', () => {
    const inner = Object.assign(new Error('duplicate key'), { code: '23505' });
    expect(isUniqueViolation(new Error('falha no insert', { cause: inner }))).toBe(true);
  });

  it('reconhece pelo nome do índice quando não vem code', () => {
    const e = new Error('duplicate key value violates unique constraint "plan_runs_one_running_idx"');
    expect(isUniqueViolation(e)).toBe(true);
  });

  it('não confunde outro erro de banco', () => {
    const e = Object.assign(new Error('foreign key'), { code: '23503' });
    expect(isUniqueViolation(e)).toBe(false);
  });

  it('não confunde erro comum', () => {
    expect(isUniqueViolation(new Error('fetch failed'))).toBe(false);
  });

  it('aguenta null e undefined', () => {
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });

  it('não entra em loop com cause circular', () => {
    const a: { cause?: unknown; message: string } = { message: 'a' };
    a.cause = a;
    expect(isUniqueViolation(a)).toBe(false);
  });
});

describe('RunLockedError', () => {
  it('carrega a mensagem que o script e a UI mostram', () => {
    expect(new RunLockedError().message).toBe('Já existe um replanejamento em andamento.');
  });

  it('é identificável por instanceof e por name', () => {
    expect(new RunLockedError()).toBeInstanceOf(Error);
    expect(new RunLockedError().name).toBe('RunLockedError');
  });
});

describe('STALE_RUN_MS', () => {
  it('é 15 minutos — folga larga sobre o run real mais longo observado (85s)', () => {
    expect(STALE_RUN_MS).toBe(15 * 60 * 1000);
  });
});
