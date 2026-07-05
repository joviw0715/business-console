import { requireAdmin, getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  async function stopImpersonating() {
    'use server';
    const s = await getSession();
    if (!s.isLoggedIn || !s.isAdmin) redirect('/login');
    s.impersonatingAccountId = undefined;
    s.impersonatingUsername = undefined;
    await s.save();
    redirect('/admin');
  }

  return (
    <div className="min-h-screen bg-background">
      {session.impersonatingAccountId && (
        <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between text-sm font-medium">
          <span>Impersonating: <strong>{session.impersonatingUsername}</strong></span>
          <form action={stopImpersonating}>
            <button type="submit" className="underline hover:no-underline">Exit</button>
          </form>
        </div>
      )}
      {children}
    </div>
  );
}
