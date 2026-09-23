import Link from 'next/link';
import { NAV_ITEMS } from '@/src/nav/items';

export default function HubPage() {
  const sectors = NAV_ITEMS.filter((it) => it.group === 'setor');

  return (
    <>
      <h1>Setores</h1>
      <p className="muted">Cada setor ainda não tem fonte conectada — chega na próxima etapa.</p>
      <div className="row" style={{ alignItems: 'stretch' }}>
        {sectors.map((s) => (
          <Link key={s.slug} href={s.href} className="card" style={{ flex: '1 1 240px', textDecoration: 'none' }}>
            <strong style={{ fontFamily: 'var(--font-display)' }}>{s.label}</strong>
            <p className="muted" style={{ marginBottom: 0 }}>este setor ainda não tem fonte conectada</p>
          </Link>
        ))}
      </div>
    </>
  );
}
