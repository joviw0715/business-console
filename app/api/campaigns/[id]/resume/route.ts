import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

// NOTE: do NOT call outboundCallsQueue.resume() here — that would unpause the global
// queue and unblock ALL other accounts' paused campaigns. Enqueueing jobs is sufficient;
// the worker picks them up as long as the queue is running normally.

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

  // Atomic check-and-set: only transitions from paused → running.
  // Prevents duplicate calls if the user double-clicks Resume.
  const { rowCount } = await pool.query(
    "UPDATE campaigns SET status = 'running' WHERE id = $1 AND status = 'paused'",
    [id],
  );
  if (!rowCount) return NextResponse.json({ error: 'Campaign is not paused' }, { status: 409 });

  try {
    await outboundCallsQueue.addBulk(
      contacts.map((contact) => ({
        name: 'dial',
        data: {
          contactId: contact.id,
          campaignId: parseInt(id),
          accountId,
          phone: contact.phone,
          voiceId: config?.voice_id ?? 'Cantonese_GentleLady',
          greetingText: config?.greeting_text ?? '',
          systemPrompt: config?.system_prompt ?? '',
          callTimeoutSec: config?.call_timeout_sec ?? 60,
        },
        opts: { jobId: `contact-${contact.id}-${Date.now()}` },
      })),
    );
  } catch (enqueueErr: unknown) {
    // Roll back the status change so the campaign isn't permanently stuck in 'running'.
    await pool.query("UPDATE campaigns SET status = 'paused' WHERE id = $1", [id]).catch(() => {});
    throw enqueueErr;
  }

  return NextResponse.json({ ok: true, enqueued: contacts.length });
}
