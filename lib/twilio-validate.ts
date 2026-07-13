import { validateRequest } from 'twilio';
import type { NextRequest } from 'next/server';
import { getAccountCredentials } from '@/lib/credentials';

/**
 * Validates the Twilio signature on an incoming webhook request.
 * Returns null on success, or a 403 Response on failure.
 *
 * @param req        The incoming Next.js request
 * @param params     The parsed form params (must be read before calling this)
 * @param accountId  The account whose Twilio auth token to use, or null to use env var
 */
export async function validateTwilioSignature(
  req: NextRequest,
  params: Record<string, string>,
  accountId: number | null,
): Promise<Response | null> {
  const authToken = accountId
    ? (await getAccountCredentials(accountId)).twilioAuthToken
    : (process.env.TWILIO_AUTH_TOKEN ?? '');

  if (!authToken) return null; // no token configured — skip validation in dev

  const sig = req.headers.get('x-twilio-signature') ?? '';

  // Twilio signs against the public URL. req.url may contain an internal hostname
  // when running behind a proxy (e.g. Zeabur). Reconstruct using WEBHOOK_BASE_URL.
  const baseUrl = (process.env.WEBHOOK_BASE_URL ?? '').replace(/\/$/, '');
  const parsed = new URL(req.url);
  const publicUrl = baseUrl
    ? `${baseUrl}${parsed.pathname}${parsed.search}`
    : req.url;

  if (!validateRequest(authToken, sig, publicUrl, params)) {
    console.warn(`[twilio-sig] invalid signature for ${parsed.pathname}`);
    console.warn(`[twilio-sig] publicUrl=${publicUrl}`);
    console.warn(`[twilio-sig] sig=${sig.slice(0, 20)}...`);
    console.warn(`[twilio-sig] authToken set=${!!authToken} length=${authToken.length}`);
    console.warn(`[twilio-sig] accountId=${accountId} WEBHOOK_BASE_URL=${process.env.WEBHOOK_BASE_URL}`);
    console.warn(`[twilio-sig] params keys=${Object.keys(params).sort().join(',')}`);
    return new Response('Forbidden', { status: 403 });
  }

  return null;
}
