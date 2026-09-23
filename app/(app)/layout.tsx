import { signOut } from '@/auth';
import { Wheel } from './wheel';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const logout = (
    <form
      action={async () => {
        'use server';
        await signOut({ redirectTo: '/login' });
      }}
      style={{ position: 'fixed', top: 8, right: 16, zIndex: 20 }}
    >
      <button type="submit" className="secondary">
        Sair
      </button>
    </form>
  );

  return (
    <>
      <Wheel />
      {logout}
      <main className="container">{children}</main>
    </>
  );
}
