import { describe, expect, it } from 'vitest';
import { parseMemoryFile, planSync } from './parse';

const raw = `---
name: tcc-estado
description: Estado do TCC
metadata:
  type: project
---

# TCC

Texto do corpo.
`;

describe('parseMemoryFile', () => {
  it('extrai slug do frontmatter, título do description e corpo sem frontmatter', () => {
    const doc = parseMemoryFile('tcc_estado.md', raw);
    expect(doc).toEqual({
      slug: 'tcc-estado',
      title: 'Estado do TCC',
      content: '# TCC\n\nTexto do corpo.',
    });
  });

  it('usa o nome do arquivo quando não há frontmatter', () => {
    const doc = parseMemoryFile('user_profile.md', 'Só texto.');
    expect(doc!.slug).toBe('user_profile');
    expect(doc!.title).toBe('user_profile');
    expect(doc!.content).toBe('Só texto.');
  });

  it('retorna null para MEMORY.md (índice, não conhecimento)', () => {
    expect(parseMemoryFile('MEMORY.md', '# Index')).toBeNull();
  });
});

describe('planSync', () => {
  it('separa upserts e deletes', () => {
    const plan = planSync(['a', 'b', 'c'], [{ slug: 'a', title: 'A', content: 'x' }, { slug: 'd', title: 'D', content: 'y' }]);
    expect(plan.upserts.map((d) => d.slug)).toEqual(['a', 'd']);
    expect(plan.deletes).toEqual(['b', 'c']);
  });
});
