import { redirect } from 'next/navigation';
import { auth, signIn } from '@/auth';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const session = await auth();
  const { next, error } = await searchParams;
  if (session?.user) redirect(next ?? '/');

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 80 }}>
      <h1>Segundo cérebro</h1>
      <p className="muted">Só uma pessoa entra aqui.</p>
      {error === 'AccessDenied' && <p>Esse e-mail não é o permitido.</p>}
      <form
        action={async () => {
          'use server';
          await signIn('google', { redirectTo: next ?? '/' });
        }}
      >
        <button type="submit">Entrar com Google</button>
      </form>
    </main>
  );
}
