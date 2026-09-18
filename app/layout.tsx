import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Segundo cérebro',
  description: 'Faculdade, trabalho e vida pessoal numa semana só.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
