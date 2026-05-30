import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { handleAdminMessage } from '@/lib/whatsapp-bot';

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Read env vars at request time (not module load) so new vars take effect without redeploy
  const whatsappNumber = process.env.TWILIO_WHATSAPP_NUMBER ?? '';
  const authToken      = process.env.TWILIO_AUTH_TOKEN ?? '';
  const consoleBaseUrl = process.env.CONSOLE_BASE_URL ?? '';

  if (!whatsappNumber) {
    console.warn('[whatsapp-bot] TWILIO_WHATSAPP_NUMBER not set');
    return new NextResponse('WhatsApp bot not configured', { status: 200 });
  }

  const webhookUrl = consoleBaseUrl
    ? `${consoleBaseUrl.replace(/\/$/, '')}/api/webhooks/whatsapp/admin`
    : null;

  // Twilio signature verification
  if (authToken && webhookUrl) {
    const signature = req.headers.get('x-twilio-signature') ?? '';
    const body = await req.text();
    const params = Object.fromEntries(new URLSearchParams(body));

    const valid = twilio.validateRequest(authToken, signature, webhookUrl, params);
    if (!valid) {
      console.warn('[whatsapp-bot] signature validation failed — url:', webhookUrl, 'sig:', signature.slice(0, 20));
      return new NextResponse('Forbidden', { status: 403 });
    }

    return processMessage(params);
  }

  // No auth token or webhook URL — skip signature check
  console.warn('[whatsapp-bot] skipping signature check (AUTH_TOKEN or CONSOLE_BASE_URL not set)');
  const body = await req.text();
  const params = Object.fromEntries(new URLSearchParams(body));
  return processMessage(params);
}

async function processMessage(params: Record<string, string>): Promise<NextResponse> {
  try {
    const from = (params['From'] ?? '').replace(/^whatsapp:/, '');

    // Interactive replies: ButtonPayload (quick-reply tap) or ListId (list-picker selection)
    // take precedence over Body so the bot sees the item id, not the display label.
    const interactiveReply = params['ButtonPayload'] ?? params['ListId'] ?? null;
    const body = interactiveReply ?? (params['Body'] ?? '');

    const numMedia = parseInt(params['NumMedia'] ?? '0', 10);
    const mediaUrl = numMedia > 0 ? params['MediaUrl0'] : undefined;
    const mediaContentType = numMedia > 0 ? params['MediaContentType0'] : undefined;

    if (!from) {
      return new NextResponse('Bad request: missing From', { status: 400 });
    }

    const messagePromise = handleAdminMessage({ from, body, numMedia, mediaUrl, mediaContentType });
    messagePromise.catch((err) => {
      console.error('[whatsapp-bot] unhandled error:', err);
    });

    return new NextResponse('', { status: 200, headers: { 'Content-Type': 'text/xml' } });
  } catch (err) {
    console.error('[whatsapp-bot] processMessage error:', err);
    return new NextResponse('', { status: 200 });
  }
}
