import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [campaign] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!campaign) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: contacts } = await pool.query(
    "SELECT id, phone FROM contacts WHERE campaign_id = $1 AND status = 'pending'",
    [id],
  );

  const { rows: [config] } = await pool.query(
    'SELECT * FROM campaign_config WHERE campaign_id = $1',
    [id],
  );

  await outboundCallsQueue.resume();

  for (const contact of contacts) {
    await outboundCallsQueue.add(
      'dial',
      {
        contactId: contact.id,
        campaignId: parseInt(id),
        accountId,
        phone: contact.phone,
        voiceId: config?.voice_id ?? 'Cantonese_GentleLady',
        greetingText: config?.greeting_text ?? '',
        systemPrompt: config?.system_prompt ?? '',
        callTimeoutSec: config?.call_timeout_sec ?? 60,
      },
      { jobId: `contact-${contact.id}-${Date.now()}` },
    );
  }

  await pool.query("UPDATE campaigns SET status = 'running' WHERE id = $1", [id]);
  return NextResponse.json({ enqueued: contacts.length });
}
