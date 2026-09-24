'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NAV_ITEMS } from '@/src/nav/items';

export function Sidebar() {
  const pathname = usePathname();
  const [expanded, setExpanded] = useState(pathname === '/');

  useEffect(() => {
    setExpanded(pathname === '/');
  }, [pathname]);

  const currentPath = pathname.split('?')[0].split('#')[0];
  const sectors = NAV_ITEMS.filter((item) => item.group === 'setor');
  const tools = NAV_ITEMS.filter((item) => item.group === 'ferramenta');

  if (!expanded) {
    return (
      <nav className="sidebar-collapsed" aria-label="Setores e ferramentas">
        <button
          type="button"
          className="sidebar-expand"
          onClick={() => setExpanded(true)}
          aria-label="Expandir barra lateral"
          aria-expanded={expanded}
        >
          &gt;
        </button>
      </nav>
    );
  }

  return (
    <nav className="sidebar-expanded" aria-label="Setores e ferramentas">
      <button
        type="button"
        className="sidebar-collapse"
        onClick={() => setExpanded(false)}
        aria-label="Colapsar barra lateral"
        aria-expanded={expanded}
      >
        &lt; SETORES
      </button>

      <div className="sidebar-group">
        <div className="sidebar-group-label">SETORES</div>
        {sectors.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            className="sidebar-link"
            data-group={item.group}
            aria-current={item.href === currentPath ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>

      <div className="sidebar-group">
        <div className="sidebar-group-label">FERRAMENTAS</div>
        {tools.map((item) => (
          <Link
            key={item.slug}
            href={item.href}
            className="sidebar-link"
            data-group={item.group}
            aria-current={item.href === currentPath ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
