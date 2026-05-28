import { NextRequest, NextResponse } from 'next/server';

const GEMINI_MODEL   = process.env.GEMINI_MODEL   ?? 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';

interface ExtractedContact {
  name: string;
  phone: string;
  custom_field: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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
    const json = await req.json();
    base64 = json.base64;
    mimeType = json.mimeType ?? 'image/jpeg';
    if (!base64) return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
  }

  const prompt = `Extract all contact entries from this image. Each entry should have a name, phone number, and optionally a time/appointment/note field.
Return ONLY a JSON array with no markdown, no explanation. Format:
[{"name":"...","phone":"...","custom_field":"..."}]
- phone: include country code if present, keep + prefix (e.g. +85212345678)
- custom_field: appointment time, note, or any other field shown (empty string "" if none)
- Skip rows that have no phone number
- If the image contains a table or list, extract every row`;

  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: { temperature: 0, response_mime_type: 'application/json' },
  };

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
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
