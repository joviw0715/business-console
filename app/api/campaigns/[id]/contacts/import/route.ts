import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { outboundCallsQueue } from '@/lib/queue';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

interface MappingEntry {
  [csvHeader: string]: 'phone' | 'name' | 'custom' | 'skip';
}

/** RFC 4180-compliant CSV line parser that handles quoted fields with embedded commas. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("") inside a quoted field
        if (line[i + 1] === '"') { field += '"'; i++; }
        else { inQuotes = false; }
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(field.trim()); field = ''; }
      else { field += ch; }
    }
  }
  fields.push(field.trim());
  return fields;
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

  const mapping: MappingEntry = JSON.parse(mappingRaw);
  const text = await file.text();
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

  let inserted = 0;
  let skipped = 0;
  const newContactIds: number[] = [];

  for (const line of lines.slice(1)) {
    const vals = parseCsvLine(line);
    const phone = vals[phoneIdx]?.trim();
    if (!phone) { skipped++; continue; }

    // Normalise to E.164 if starts with local HK prefix
    const normalised = phone.startsWith('0') ? `+852${phone.slice(1)}` : phone;

    const name = nameIdx >= 0 ? vals[nameIdx] ?? null : null;
    const custom = customCols.length
      ? Object.fromEntries(customCols.map(({ header, idx }) => [header, vals[idx] ?? '']))
      : null;

    try {
      const { rows: [row] } = await pool.query(
        `INSERT INTO contacts (campaign_id, phone, name, custom_data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [id, normalised, name, custom ? JSON.stringify(custom) : null],
      );
      if (row) { inserted++; newContactIds.push(row.id); }
      else skipped++;
    } catch { skipped++; }
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
    for (const contact of newContacts) {
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
        { jobId: `contact-${contact.id}` },
      );
    }
  }

  return NextResponse.json({ inserted, skipped });
}
