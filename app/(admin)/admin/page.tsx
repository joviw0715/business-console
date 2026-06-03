import { requireAdmin } from '@/lib/auth';
import AdminPageClient from './client';
import pool from '@/lib/db';

export default async function AdminPage() {
  const session = await requireAdmin();

  const { rows: accounts } = await pool.query(
    `SELECT id, username, display_name, is_admin, created_at FROM accounts ORDER BY created_at ASC`,
  );

  return (
    <AdminPageClient
      accounts={accounts}
      currentAccountId={session.accountId}
      impersonatingAccountId={session.impersonatingAccountId}
      impersonatingUsername={session.impersonatingUsername}
    />
  );
}
