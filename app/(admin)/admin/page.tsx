import { requireAdmin } from '@/lib/auth';
import AdminPageClient from './client';
import pool from '@/lib/db';

export default async function AdminPage() {
  const session = await requireAdmin();

  const { rows: accounts } = await pool.query(
    `SELECT id, username, display_name, is_admin, created_at,
            twilio_account_sid, twilio_auth_token, twilio_phone_number,
            gemini_api_key, voice_webhook_url, webhook_base_url,
            (SELECT COUNT(*)::int FROM hotlines WHERE account_id = accounts.id) AS hotline_count,
            (SELECT COUNT(*)::int FROM campaigns WHERE account_id = accounts.id) AS campaign_count,
            (SELECT COUNT(*)::int FROM inbound_calls WHERE account_id = accounts.id) AS inbound_count,
            (SELECT COUNT(*)::int FROM call_reports cr JOIN campaigns c ON c.id = cr.campaign_id WHERE c.account_id = accounts.id) AS outbound_count
     FROM accounts ORDER BY created_at ASC`,
  );

  const enriched = accounts.map(r => ({
    ...r,
    setup_health: ([r.twilio_account_sid, r.twilio_auth_token, r.twilio_phone_number, r.gemini_api_key, r.voice_webhook_url, r.webhook_base_url].filter(Boolean).length >= 5)
      ? 'ready'
      : ([r.twilio_account_sid, r.gemini_api_key].some(Boolean) ? 'partial' : 'not_configured'),
  }));

  return (
    <AdminPageClient
      accounts={enriched}
      currentAccountId={session.accountId}
      impersonatingAccountId={session.impersonatingAccountId}
      impersonatingUsername={session.impersonatingUsername}
    />
  );
}
