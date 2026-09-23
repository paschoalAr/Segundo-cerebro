import { describe, expect, it } from 'vitest';
import { planFactSync } from './sync';

describe('planFactSync', () => {
  it('separa upserts (tudo que veio) e deletes (o que sumiu)', () => {
    const plan = planFactSync(
      ['a', 'b', 'c'],
      [{ sourceRef: 'a', title: 'A' }, { sourceRef: 'd', title: 'D' }],
    );
    expect(plan.upserts.map((i) => i.sourceRef)).toEqual(['a', 'd']);
    expect(plan.deletes).toEqual(['b', 'c']);
  });

  it('sem nada existente, só upserts', () => {
    const plan = planFactSync([], [{ sourceRef: 'x', title: 'X' }]);
    expect(plan.deletes).toEqual([]);
  });
});
