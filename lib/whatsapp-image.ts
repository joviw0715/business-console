// Twilio stores inbound media for ~3 hours. Must download immediately in the webhook handler.
export async function downloadTwilioMedia(mediaUrl: string): Promise<{ base64: string; mimeType: string }> {
  const sid   = process.env.TWILIO_ACCOUNT_SID   ?? '';
  const token = process.env.TWILIO_AUTH_TOKEN    ?? '';
  const credentials = Buffer.from(`${sid}:${token}`).toString('base64');
  const res = await fetch(mediaUrl, {
    headers: { Authorization: `Basic ${credentials}` },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Twilio media fetch failed: ${res.status} ${res.statusText}`);

  const mimeType = res.headers.get('content-type') ?? 'image/jpeg';
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return { base64, mimeType };
}
