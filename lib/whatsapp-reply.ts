import { twilioClient } from './twilio';

const FROM = process.env.TWILIO_WHATSAPP_NUMBER ?? '';

export async function waReply(to: string, body: string): Promise<void> {
  const toFormatted = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const fromFormatted = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;
  await twilioClient.messages.create({ from: fromFormatted, to: toFormatted, body });
}
