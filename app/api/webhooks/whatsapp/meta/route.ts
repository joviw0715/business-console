import { NextRequest, NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { handleAdminMessage } from '@/lib/whatsapp-bot';

// GET: Meta webhook verification handshake
export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const mode      = searchParams.get('hub.mode');
  const token     = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_WA_VERIFY_TOKEN) {
    return new NextResponse(challenge ?? '', { status: 200 });
  }
  return new NextResponse('Forbidden', { status: 403 });
}

// POST: incoming messages from Meta
export async function POST(req: NextRequest): Promise<NextResponse> {
  const appSecret = process.env.META_WA_APP_SECRET ?? '';
  const rawBody   = await req.text();

  // Validate x-hub-signature-256
  if (appSecret) {
    const sig = req.headers.get('x-hub-signature-256') ?? '';
    const expected = `sha256=${createHmac('sha256', appSecret).update(rawBody).digest('hex')}`;
    if (sig !== expected) {
      console.warn('[meta-wa] signature validation failed');
      return new NextResponse('Forbidden', { status: 403 });
    }
  } else {
    console.warn('[meta-wa] META_WA_APP_SECRET not set — skipping signature check');
  }

  let payload: MetaWebhookPayload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return new NextResponse('Bad request', { status: 400 });
  }

  // Meta sends batched entries — process each message async
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (!value?.messages) continue;

      for (const msg of value.messages) {
        const from = msg.from; // plain E.164, e.g. "85298765432"
        const { body, interactiveReply, numMedia, mediaUrl, mediaContentType } = extractMessage(msg);

        const messagePromise = handleAdminMessage({ from, body: interactiveReply ?? body, numMedia, mediaUrl, mediaContentType });
        messagePromise.catch((err) => console.error('[meta-wa] handleAdminMessage error:', err));
      }
    }
  }

  // Meta requires a 200 response immediately
  return NextResponse.json({ ok: true });
}

function extractMessage(msg: MetaMessage): {
  body: string;
  interactiveReply: string | null;
  numMedia: number;
  mediaUrl?: string;
  mediaContentType?: string;
} {
  if (msg.type === 'text') {
    return { body: msg.text?.body ?? '', interactiveReply: null, numMedia: 0 };
  }

  if (msg.type === 'interactive') {
    const reply = msg.interactive?.button_reply ?? msg.interactive?.list_reply;
    return { body: reply?.title ?? '', interactiveReply: reply?.id ?? null, numMedia: 0 };
  }

  if (msg.type === 'image' || msg.type === 'audio' || msg.type === 'document') {
    const media = msg.image ?? msg.audio ?? msg.document;
    // Media ID needs to be fetched separately from Meta's media endpoint
    // Pass the media ID as the URL — whatsapp-image.ts will need a Meta download path
    const mediaId = media?.id;
    const mimeType = media?.mime_type;
    return {
      body: msg.image?.caption ?? '',
      interactiveReply: null,
      numMedia: mediaId ? 1 : 0,
      mediaUrl: mediaId ? `meta-media:${mediaId}` : undefined,
      mediaContentType: mimeType,
    };
  }

  return { body: '', interactiveReply: null, numMedia: 0 };
}

// ---- Types ----

interface MetaWebhookPayload {
  entry?: MetaEntry[];
}

interface MetaEntry {
  changes?: MetaChange[];
}

interface MetaChange {
  value?: MetaChangeValue;
}

interface MetaChangeValue {
  messages?: MetaMessage[];
}

interface MetaMessage {
  from: string;
  type: string;
  text?: { body: string };
  interactive?: {
    button_reply?: { id: string; title: string };
    list_reply?:   { id: string; title: string };
  };
  image?:    { id: string; caption?: string; mime_type: string };
  audio?:    { id: string; mime_type: string };
  document?: { id: string; mime_type: string };
}
