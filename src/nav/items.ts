export type NavGroup = 'setor' | 'ferramenta';

export type NavItem = {
  slug: string;
  href: string;
  label: string;
  group: NavGroup;
};

export const NAV_ITEMS: NavItem[] = [
  { slug: 'estudos', href: '/setor/estudos', label: 'Estudos', group: 'setor' },
  { slug: 'carreira', href: '/setor/carreira', label: 'Carreira', group: 'setor' },
  { slug: 'financas', href: '/setor/financas', label: 'Finanças', group: 'setor' },
  { slug: 'saude', href: '/setor/saude', label: 'Saúde', group: 'setor' },
  { slug: 'projetos', href: '/setor/projetos', label: 'Projetos', group: 'setor' },
  { slug: 'pessoal', href: '/setor/pessoal', label: 'Pessoal', group: 'setor' },
  { slug: 'semana', href: '/semana', label: 'Semana', group: 'ferramenta' },
  { slug: 'inbox', href: '/inbox', label: 'Inbox', group: 'ferramenta' },
  { slug: 'pendencias', href: '/pendencias', label: 'Pendências', group: 'ferramenta' },
  { slug: 'manual', href: '/manual', label: 'Manual', group: 'ferramenta' },
];

export const SECTOR_SLUGS = NAV_ITEMS.filter((it) => it.group === 'setor').map((it) => it.slug);
