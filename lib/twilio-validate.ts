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
  const url = req.url;

  if (!validateRequest(authToken, sig, url, params)) {
    console.warn(`[twilio-sig] invalid signature for ${new URL(url).pathname}`);
    return new Response('Forbidden', { status: 403 });
  }

  return null;
}
