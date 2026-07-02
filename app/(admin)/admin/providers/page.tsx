import { requireAdmin } from '@/lib/auth';
import pool from '@/lib/db';
import ProvidersClient from './client';

export const dynamic = 'force-dynamic';

async function fetchProviderConfig() {
  try {
    const { rows } = await pool.query(
      `SELECT key, value FROM app_settings WHERE key = ANY($1)`,
      [['provider:llm', 'provider:tts', 'provider:stt']],
    );
    const map = Object.fromEntries(rows.map((r: { key: string; value: string }) => [r.key, r.value]));
    return {
      llm: map['provider:llm'] ?? 'auto',
      tts: map['provider:tts'] ?? 'auto',
      stt: map['provider:stt'] ?? 'auto',
    };
  } catch {
    return { llm: 'auto', tts: 'auto', stt: 'auto' };
  }
}

export default async function ProvidersPage() {
  await requireAdmin();
  const config = await fetchProviderConfig();
  return <ProvidersClient config={config} />;
}
