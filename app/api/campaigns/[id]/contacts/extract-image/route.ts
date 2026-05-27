import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
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

  const prompt = `Extract all contact entries from this image. Each entry should have a name, phone number, and optionally a time/appointment/note field.
Return ONLY a JSON array with no markdown, no explanation. Format:
[{"name":"...","phone":"...","custom_field":"..."}]
- phone: digits only, keep country code if present (e.g. +85212345678)
- custom_field: appointment time, note, or any other field shown (leave empty string "" if none)
- Skip rows that have no phone number
- If the image contains a table or list, extract every row`;

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
