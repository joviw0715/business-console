import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { parseCsvLine } from '@/lib/csv';

interface MappingEntry {
  [csvHeader: string]: 'phone' | 'name' | 'custom' | 'skip';
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  // Verify the campaign belongs to this account (prevents IDOR)
  const { rows: [owned] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const mappingRaw = formData.get('mapping') as string | null;

  if (!file || !mappingRaw) {
    return NextResponse.json({ error: 'Missing file or mapping' }, { status: 400 });
  }

  const mapping: MappingEntry = (() => {
    try { return JSON.parse(mappingRaw); }
    catch { return null; }
  })();
  if (!mapping || typeof mapping !== 'object') {
    return NextResponse.json({ error: 'Invalid mapping JSON' }, { status: 400 });
  }
  const text = (await file.text()).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = text.trim().split('\n');
  const headers = parseCsvLine(lines[0]);

  const phoneCol = Object.entries(mapping).find(([, v]) => v === 'phone')?.[0];
  const nameCol  = Object.entries(mapping).find(([, v]) => v === 'name')?.[0];

  if (!phoneCol) {
    return NextResponse.json({ error: 'No phone column mapped' }, { status: 400 });
  }

  const phoneIdx = headers.indexOf(phoneCol);
  const nameIdx  = nameCol ? headers.indexOf(nameCol) : -1;

  const customCols = Object.entries(mapping)
    .filter(([, v]) => v === 'custom')
    .map(([h]) => ({ header: h, idx: headers.indexOf(h) }));

  // Parse all rows first, then bulk-insert in one round-trip
  type ContactRow = { phone: string; name: string | null; custom: string | null };
  const toInsert: ContactRow[] = [];
  let skipped = 0;

  for (const line of lines.slice(1)) {
    const vals = parseCsvLine(line);
    const phone = vals[phoneIdx]?.trim();
    if (!phone) { skipped++; continue; }

    // Normalise to E.164 if starts with local HK prefix
    const normalised = phone.startsWith('0') ? `+852${phone.slice(1)}` : phone;
    const name = nameIdx >= 0 ? vals[nameIdx] ?? null : null;
    const custom = customCols.length
      ? JSON.stringify(Object.fromEntries(customCols.map(({ header, idx }) => [header, vals[idx] ?? ''])))
      : null;
    toInsert.push({ phone: normalised, name, custom });
  }

  let inserted = 0;
  const newContactIds: number[] = [];

  // Chunk to 1000 rows per INSERT to stay well under PostgreSQL's 65535 bind-param limit (4 params/row)
  const CHUNK = 1000;
  for (let offset = 0; offset < toInsert.length; offset += CHUNK) {
    const chunk = toInsert.slice(offset, offset + CHUNK);
    const placeholders = chunk.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
    const values = chunk.flatMap(({ phone, name, custom }) => [id, phone, name, custom]);
    try {
      const { rows } = await pool.query(
        `INSERT INTO contacts (campaign_id, phone, name, custom_data)
         VALUES ${placeholders}
         ON CONFLICT DO NOTHING
         RETURNING id`,
        values,
      );
      inserted += rows.length;
      newContactIds.push(...rows.map((r: { id: number }) => r.id));
      skipped += chunk.length - rows.length;
    } catch {
      skipped += chunk.length;
    }
  }

  // If campaign is already running, enqueue ONLY the newly inserted contacts
  const { rows: [campaign] } = await pool.query(
    'SELECT status FROM campaigns WHERE id = $1',
    [id],
  );

  if (campaign?.status === 'running' && newContactIds.length > 0) {
    const { rows: [config] } = await pool.query(
      'SELECT * FROM campaign_config WHERE campaign_id = $1',
      [id],
    );
    const { rows: newContacts } = await pool.query(
      "SELECT id, phone FROM contacts WHERE id = ANY($1) AND status = 'pending'",
      [newContactIds],
    );
    try {
      await outboundCallsQueue.addBulk(
        newContacts.map((contact) => ({
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
          opts: { jobId: `contact-${contact.id}` },
        })),
      );
    } catch (enqueueErr: unknown) {
      // Contacts are already in the DB — do not fail the import.
      // The worker will pick them up when it next processes the running campaign.
      console.error(`[contacts/import] addBulk failed (contacts saved):`, enqueueErr instanceof Error ? enqueueErr.message : String(enqueueErr));
    }
  }

  return NextResponse.json({ inserted, skipped });
}
