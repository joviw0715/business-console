import { requireAdmin } from '@/lib/auth';
import AccountDetailClient from './client';

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  return <AccountDetailClient accountId={id} />;
}
