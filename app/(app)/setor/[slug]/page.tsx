import { notFound } from 'next/navigation';
import { NAV_ITEMS, SECTOR_SLUGS } from '@/src/nav/items';

export default async function SetorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!SECTOR_SLUGS.includes(slug)) notFound();

  const item = NAV_ITEMS.find((it) => it.slug === slug)!;

  return (
    <>
      <h1>{item.label}</h1>
      <p className="muted">este setor ainda não tem fonte conectada</p>
    </>
  );
}
