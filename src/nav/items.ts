import { SECTORS, SECTOR_LABELS } from '@/src/sectors/sector';

export type NavGroup = 'setor' | 'ferramenta';

export type NavItem = {
  slug: string;
  href: string;
  label: string;
  group: NavGroup;
};

const SECTOR_ITEMS: NavItem[] = SECTORS.map((slug) => ({
  slug,
  href: `/setor/${slug}`,
  label: SECTOR_LABELS[slug],
  group: 'setor',
}));

export const NAV_ITEMS: NavItem[] = [
  ...SECTOR_ITEMS,
  { slug: 'semana', href: '/semana', label: 'Semana', group: 'ferramenta' },
  { slug: 'inbox', href: '/inbox', label: 'Inbox', group: 'ferramenta' },
  { slug: 'pendencias', href: '/pendencias', label: 'Pendências', group: 'ferramenta' },
  { slug: 'manual', href: '/manual', label: 'Manual', group: 'ferramenta' },
];

export const SECTOR_SLUGS = NAV_ITEMS.filter((it) => it.group === 'setor').map((it) => it.slug);
