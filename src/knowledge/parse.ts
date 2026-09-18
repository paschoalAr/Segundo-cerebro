import matter from 'gray-matter';

export type KnowledgeDoc = { slug: string; title: string; content: string };

export function parseMemoryFile(filename: string, raw: string): KnowledgeDoc | null {
  if (filename === 'MEMORY.md') return null;

  const { data, content } = matter(raw);
  const base = filename.replace(/\.md$/, '');
  const slug = typeof data.name === 'string' && data.name.trim() ? data.name.trim() : base;
  const title =
    typeof data.description === 'string' && data.description.trim() ? data.description.trim() : slug;

  return { slug, title, content: content.trim() };
}

export function planSync(existingSlugs: string[], docs: KnowledgeDoc[]) {
  const incoming = new Set(docs.map((d) => d.slug));
  return {
    upserts: docs,
    deletes: existingSlugs.filter((s) => !incoming.has(s)),
  };
}
