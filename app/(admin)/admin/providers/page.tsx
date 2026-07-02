import { requireAdmin } from '@/lib/auth';
import ProvidersClient from './client';

export const dynamic = 'force-dynamic';

async function fetchProviderConfig() {
  const webhookUrl = (process.env.VOICE_WEBHOOK_URL || '').replace(/\/$/, '');
  const token = process.env.CONSOLE_API_TOKEN || process.env.SESSION_SECRET || '';
  if (!webhookUrl) return { llm: 'auto', tts: 'auto', stt: 'auto' };
  try {
    const res = await fetch(`${webhookUrl}/admin/providers`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: 'no-store',
    });
    if (!res.ok) return { llm: 'auto', tts: 'auto', stt: 'auto' };
    return res.json();
  } catch {
    return { llm: 'auto', tts: 'auto', stt: 'auto' };
  }
}

export default async function ProvidersPage() {
  await requireAdmin();
  const config = await fetchProviderConfig();

  return <ProvidersClient config={config} />;
}
