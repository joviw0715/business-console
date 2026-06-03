import { requireAuth } from '@/lib/auth';
import Sidebar from '@/components/layout/sidebar';
import BottomNav from '@/components/layout/bottom-nav';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAuth();

  return (
    <div className="flex h-full">
      <Sidebar
        isAdmin={session.isAdmin}
        impersonatingUsername={session.impersonatingUsername}
      />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      <BottomNav />
    </div>
  );
}
