import { getWaProvider } from './wa-provider';
import type { BookingTemplateVars } from './wa-provider';

export async function sendBookingConfirmation(
  toPhone: string,
  vars: BookingTemplateVars,
  accountId: number,
): Promise<void> {
  const provider = await getWaProvider(accountId);
  await provider.sendBookingTemplate(toPhone, {
    restaurant: vars.restaurant || '餐廳',
    customer:   vars.customer   || '客人',
    status:     vars.status     || '確認',
    date:       vars.date       || '-',
    time:       vars.time       || '-',
    people:     vars.people     || '-',
  });
  console.log(`[wa-confirmation] sent to ${toPhone} — ${vars.customer} ${vars.date} ${vars.time}`);
}
