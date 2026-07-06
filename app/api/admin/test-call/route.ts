import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSipProvider } from '@/lib/sip-provider';

export async function POST(req: Request) {
  await requireAdmin();
  let phone: string, accountId: number;
  try {
    ({ phone, accountId } = await req.json());
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!phone || !accountId) {
    return NextResponse.json({ error: 'phone and accountId are required' }, { status: 400 });
  }

  const sipProvider = await getSipProvider(accountId);
  if (!sipProvider) {
    return NextResponse.json({ error: 'FreeSWITCH not configured for this account' }, { status: 400 });
  }

  try {
    console.log(`[test-call] initiating call to ${phone} via FreeSWITCH`);
    const callUuid = await sipProvider.initiateCall({
      to: phone,
      contactId: 0,
      campaignId: 0,
      twimlUrl: '',
      statusCallbackUrl: '',
      amdCallbackUrl: '',
      recordingCallbackUrl: '',
      timeoutSec: 60,
    });
    console.log(`[test-call] success — uuid: ${callUuid}`);
    return NextResponse.json({ ok: true, callUuid });
  } catch (err) {
    console.error(`[test-call] failed — ${(err as Error).message}`);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
