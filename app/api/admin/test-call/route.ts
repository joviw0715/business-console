import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { getSipProvider } from '@/lib/sip-provider';

export async function POST(req: Request) {
  await requireAdmin();
  const { phone, accountId } = await req.json();

  if (!phone || !accountId) {
    return NextResponse.json({ error: 'phone and accountId are required' }, { status: 400 });
  }

  const sipProvider = await getSipProvider(accountId);
  if (!sipProvider) {
    return NextResponse.json({ error: 'FreeSWITCH not configured for this account' }, { status: 400 });
  }

  try {
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
    return NextResponse.json({ ok: true, callUuid });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
