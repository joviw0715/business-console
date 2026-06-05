import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  await params; // id not needed for extraction

  const formData = await req.formData();
  const file = formData.get('image') as File | null;
  if (!file) return NextResponse.json({ error: 'No image provided' }, { status: 400 });
  if (!GEMINI_API_KEY) return NextResponse.json({ error: 'GEMINI_API_KEY not set' }, { status: 500 });

  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString('base64');
  const mimeType = file.type || 'image/jpeg';

  const prompt = `Extract all booking/contact entries from this image. Entries may span multiple lines — group lines that belong to the same person together.
Return ONLY a JSON array with no markdown, no explanation. Format:
[{"name":"...","phone":"...","time":"...","date":"...","party_size":"...","remarks":"..."}]
- name: person's name (empty string if not found)
- phone: digits only, keep + prefix if present (e.g. +85212345678 or 51873117)
- time: appointment time in HH:MM 24-hour format (e.g. "19:00" for 7pm, empty string if not found)
- date: appointment date in YYYY-MM-DD format (e.g. "2026-06-07" for Jun 7; if year is missing assume 2026, empty string if not found)
- party_size: number of people as a plain number string (e.g. "2" for 2位, empty string if not found)
- remarks: any other notes not covered above (empty string if none)
- Skip entries that have no phone number
- Group multi-line entries: e.g. "黃生 51873117" on one line and "7pm Jun 7 2位" on the next line belong to the same person`;

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
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
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
