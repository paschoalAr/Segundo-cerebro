'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ITEMS = [
  { href: '/', label: 'Semana' },
  { href: '/inbox', label: 'Inbox' },
  { href: '/pendencias', label: 'Pendências' },
  { href: '/manual', label: 'Manual' },
];

export function Nav({ pendingCount, logout }: { pendingCount: number; logout: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <nav className="nav">
      {ITEMS.map((it) => {
        const current = it.href === '/' ? pathname === '/' : pathname.startsWith(it.href);
        const badge = it.href === '/pendencias' && pendingCount > 0 ? ` (${pendingCount})` : '';
        return (
          <Link key={it.href} href={it.href} aria-current={current ? 'page' : undefined}>
            {it.label}
            {badge}
          </Link>
        );
      })}
      <span className="spacer" />
      {logout}
    </nav>
  );
}
