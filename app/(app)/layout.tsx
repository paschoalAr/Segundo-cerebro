import { signOut } from '@/auth';
import { Nav } from './nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  // pendingCount vira consulta real no plano 3 (perguntas + sugestões abertas).
  const logout = (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
    >
      <button type="submit" className="secondary">
        Sair
      </button>
    </form>
  );

  return (
    <>
      <Nav pendingCount={0} logout={logout} />
      <main className="container">{children}</main>
    </>
  );
}
