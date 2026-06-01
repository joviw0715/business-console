import { twilioClient } from './twilio';

const WA_TEMPLATE_SID = 'HXdb85837944bae97750c73ab1e169e988';

export interface BookingConfirmationVars {
  restaurant: string;
  customer: string;
  status: string;
  date: string;
  time: string;
  people: string;
}

export async function sendBookingConfirmation(
  toPhone: string,
  vars: BookingConfirmationVars,
): Promise<void> {
  const FROM = process.env.TWILIO_WHATSAPP_NUMBER ?? '';
  const from = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;
  const to   = toPhone.startsWith('whatsapp:') ? toPhone : `whatsapp:${toPhone}`;

  await twilioClient.messages.create({
    from,
    to,
    contentSid: WA_TEMPLATE_SID,
    contentVariables: JSON.stringify({
      1: vars.restaurant || '餐廳',
      2: vars.customer   || '客人',
      3: vars.status     || '已確認',
      4: vars.date       || '',
      5: vars.time       || '',
      6: vars.people     || '',
    }),
  });

  console.log(`[wa-confirmation] sent to ${toPhone} — ${vars.customer} ${vars.date} ${vars.time}`);
}
