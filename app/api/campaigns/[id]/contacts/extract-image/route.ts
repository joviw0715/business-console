import { NextRequest, NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { getAccountCredentials } from '@/lib/credentials';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  // Verify the campaign belongs to this account (prevents quota abuse / IDOR)
  const { rows: [owned] } = await pool.query(
    'SELECT id FROM campaigns WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const creds = await getAccountCredentials(accountId);
  const GEMINI_API_KEY = creds.geminiApiKey;
  const GEMINI_MODEL = creds.geminiModel || 'gemini-2.5-flash';

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  if (!GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mimeType = file.type || 'image/jpeg';

  const prompt = `Extract ALL booking/contact entries from this image. There may be multiple contacts — find every single one.
Entries may span multiple lines — group lines that belong to the same person together.
Return ONLY a JSON array with no markdown, no explanation. Format:
[{"name":"...","phone":"...","time":"...","date":"...","party_size":"...","remarks":"..."}]
- name: person's name (empty string if not found)
- phone: digits only, keep + prefix if present (e.g. +85212345678 or 51873117)
- time: appointment time in HH:MM 24-hour format (e.g. "19:00" for 7pm, "21:00" for 9pm, empty string if not found)
- date: appointment date in YYYY-MM-DD format (e.g. "2026-06-07" for Jun 7, "2026-06-08" for Jun 8; if year is missing assume 2026, empty string if not found)
- party_size: number of people as a plain number string (e.g. "2" for 2位 or 2人, empty string if not found)
- remarks: any other notes not covered above (empty string if none)
- Skip entries that have no phone number
- IMPORTANT: extract every contact in the image, not just the first one
- Grouping example: "黃生 51873117" on line 1, "7pm Jun 7 2位" on line 2 → one entry for 黃生; "Joy 55304334" on line 3, "9pm Jun 8 3位" on line 4 → one entry for Joy`;

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inline_data: { mime_type: mimeType, data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0, response_mime_type: 'application/json' },
  };

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) },
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 502 });
  }

  const geminiData = await geminiRes.json();
  const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  let contacts: { name: string; phone: string; custom_field: string }[];
  try {
    contacts = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Failed to parse Gemini response', raw }, { status: 502 });
  }

  return NextResponse.json({ contacts });
}
