import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  console.log(`[start] campaign ${id} — querying pending contacts`);

  const { rows: contacts } = await pool.query(
    "SELECT id, phone FROM contacts WHERE campaign_id = $1 AND status = 'pending'",
    [id],
  );
  console.log(`[start] campaign ${id} — found ${contacts.length} pending contacts`);

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
        phone: contact.phone,
        voiceId: config?.voice_id ?? 'Cantonese_GentleLady',
        greetingText: config?.greeting_text ?? '',
        systemPrompt: config?.system_prompt ?? '',
        callTimeoutSec: config?.call_timeout_sec ?? 60,
      },
      { jobId: `contact-${contact.id}` },
    );
    console.log(`[start] enqueued contact ${contact.id} (${contact.phone})`);
  }

  await pool.query("UPDATE campaigns SET status = 'running' WHERE id = $1", [id]);
  console.log(`[start] campaign ${id} set to running, enqueued ${contacts.length} jobs`);

  return NextResponse.json({ enqueued: contacts.length });
}
