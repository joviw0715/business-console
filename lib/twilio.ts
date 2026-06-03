import twilio from 'twilio';
import { getAccountCredentials } from '@/lib/credentials';

export async function getTwilioClient(accountId: number) {
  const creds = await getAccountCredentials(accountId);
  return twilio(creds.twilioAccountSid, creds.twilioAuthToken);
}
