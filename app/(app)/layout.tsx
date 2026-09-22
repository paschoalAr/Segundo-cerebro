import { signOut } from '@/auth';
import { countOpenQuestions } from '@/src/questions/repo';
import { countPendingSuggestions } from '@/src/manual/suggestions-repo';
import { Nav } from './nav';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [openQuestions, pendingSuggestions] = await Promise.all([countOpenQuestions(), countPendingSuggestions()]);

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
      <Nav pendingCount={openQuestions + pendingSuggestions} logout={logout} />
      <main className="container">{children}</main>
    </>
  );
}
