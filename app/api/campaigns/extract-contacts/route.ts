import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { getAccountCredentials } from '@/lib/credentials';

interface ExtractedContact {
  name: string;
  phone: string;
  time: string;
  date: string;
  party_size: string;
  remarks: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const creds = await getAccountCredentials(accountId);
  const GEMINI_API_KEY = creds.geminiApiKey;
  const GEMINI_MODEL = creds.geminiModel || 'gemini-2.5-flash';

  if (!GEMINI_API_KEY) {
    return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 503 });
  }

  let base64: string;
  let mimeType: string;

  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const file = form.get('image') as File | null;
    if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    mimeType = file.type || 'image/jpeg';
    const buf = await file.arrayBuffer();
    base64 = Buffer.from(buf).toString('base64');
  } else {
    let json: Record<string, unknown>;
    try { json = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }
    base64 = json.base64 as string;
    mimeType = (json.mimeType as string) ?? 'image/jpeg';
    if (!base64) return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
  }

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
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: { temperature: 0, response_mime_type: 'application/json' },
  };

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) },
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error: ${geminiRes.status}`, detail: err }, { status: 502 });
  }

  const data = await geminiRes.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';

  let contacts: ExtractedContact[];
  try {
    contacts = JSON.parse(raw) as ExtractedContact[];
  } catch {
    return NextResponse.json({ error: 'Failed to parse Gemini response', raw }, { status: 502 });
  }

  return NextResponse.json({ contacts });
}
