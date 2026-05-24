import { NextResponse } from 'next/server';
import pool from '@/lib/db';

interface MappingEntry {
  [csvHeader: string]: 'phone' | 'name' | 'custom' | 'skip';
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  const mappingRaw = formData.get('mapping') as string | null;

  if (!file || !mappingRaw) {
    return NextResponse.json({ error: 'Missing file or mapping' }, { status: 400 });
  }

  const mapping: MappingEntry = JSON.parse(mappingRaw);
  const text = await file.text();
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, ''));

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

  for (const line of lines.slice(1)) {
    const vals = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const phone = vals[phoneIdx]?.trim();
    if (!phone) { skipped++; continue; }

    // Normalise to E.164 if starts with local HK prefix
    const normalised = phone.startsWith('0') ? `+852${phone.slice(1)}` : phone;

    const name = nameIdx >= 0 ? vals[nameIdx] ?? null : null;
    const custom = customCols.length
      ? Object.fromEntries(customCols.map(({ header, idx }) => [header, vals[idx] ?? '']))
      : null;

    try {
      await pool.query(
        `INSERT INTO contacts (campaign_id, phone, name, custom_data)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [id, normalised, name, custom ? JSON.stringify(custom) : null],
      );
      inserted++;
    } catch { skipped++; }
  }

  return NextResponse.json({ inserted, skipped });
}
