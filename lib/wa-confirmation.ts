import { twilioClient } from './twilio';

const DEFAULT_WA_TEMPLATE_SID = 'HXdb85837944bae97750c73ab1e169e988';

export interface BookingConfirmationVars {
  restaurant: string;
  customer: string;
  status: string;
  date: string;
  time: string;
  people: string;
  templateSid?: string;
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
    contentSid: vars.templateSid || DEFAULT_WA_TEMPLATE_SID,
    contentVariables: JSON.stringify({
      restaurant: vars.restaurant || '餐廳',
      customer:   vars.customer   || '客人',
      status:     vars.status     || '已確認',
      date:       vars.date       || '-',
      time:       vars.time       || '-',
      people:     vars.people     || '-',
    }),
  });

  console.log(`[wa-confirmation] sent to ${toPhone} — ${vars.customer} ${vars.date} ${vars.time}`);
}
