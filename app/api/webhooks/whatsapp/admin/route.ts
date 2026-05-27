import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { handleAdminMessage } from '@/lib/whatsapp-bot';

// Feature gate — if TWILIO_WHATSAPP_NUMBER is not set, the bot is disabled.
// Must return 200 so Twilio stops retrying the webhook.
const ENABLED = !!process.env.TWILIO_WHATSAPP_NUMBER;

const AUTH_TOKEN  = process.env.TWILIO_AUTH_TOKEN ?? '';
const WEBHOOK_URL = process.env.CONSOLE_BASE_URL
  ? `${process.env.CONSOLE_BASE_URL.replace(/\/$/, '')}/api/webhooks/whatsapp/admin`
  : null;

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!ENABLED) {
    return new NextResponse('WhatsApp bot not configured', { status: 200 });
  }

  // Twilio signature verification — rejects spoofed webhooks
  if (AUTH_TOKEN && WEBHOOK_URL) {
    const signature = req.headers.get('x-twilio-signature') ?? '';
    const body = await req.text();
    const params = Object.fromEntries(new URLSearchParams(body));

    const valid = twilio.validateRequest(AUTH_TOKEN, signature, WEBHOOK_URL, params);
    if (!valid) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    return processMessage(params);
  }

  // Fallback if WEBHOOK_URL not configured — skip signature check (dev only)
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  return processMessage(params);
}

async function processMessage(params: Record<string, string>): Promise<NextResponse> {
  try {
    const from = (params['From'] ?? '').replace(/^whatsapp:/, '');
    const body = params['Body'] ?? '';
    const numMedia = parseInt(params['NumMedia'] ?? '0', 10);
    const mediaUrl = numMedia > 0 ? params['MediaUrl0'] : undefined;
    const mediaContentType = numMedia > 0 ? params['MediaContentType0'] : undefined;

    if (!from) {
      return new NextResponse('Bad request: missing From', { status: 400 });
    }

    // Run bot logic asynchronously so we return 200 to Twilio immediately.
    // Twilio requires a response within 15 seconds; Gemini Vision can take 5–10s.
    // waitUntil keeps the handler alive after the response is sent (Next.js edge-compatible).
    const messagePromise = handleAdminMessage({ from, body, numMedia, mediaUrl, mediaContentType });

    // In Next.js App Router we can't use waitUntil directly, so we fire and let the
    // serverless function stay open (Zeabur keeps the process alive long enough).
    messagePromise.catch((err) => {
      console.error('[whatsapp-bot] unhandled error:', err);
    });

    // Twilio expects either empty 200 or a TwiML response.
    // Empty 200 tells Twilio "received, no immediate reply needed" (we reply async via API).
    return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('[whatsapp-bot] processMessage error:', err);
    return new NextResponse('', { status: 200 }); // Still 200 — don't let Twilio retry on our errors
  }
}
