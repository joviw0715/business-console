import { twilioClient } from './twilio';

const FROM = process.env.TWILIO_WHATSAPP_NUMBER ?? '';

function fmt(phone: string) {
  const to = phone.startsWith('whatsapp:') ? phone : `whatsapp:${phone}`;
  const from = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;
  return { to, from };
}

export async function waReply(to: string, body: string): Promise<void> {
  const { to: toF, from } = fmt(to);
  await twilioClient.messages.create({ from, to: toF, body });
}

export interface ListItem {
  id: string;
  title: string;
  description?: string;
}

// Send a numbered list as plain text — twilio/list-picker requires WhatsApp Business API
// approval (error 21656) which is not available on all accounts.
export async function waListPicker(
  to: string,
  body: string,
  buttonLabel: string,
  items: ListItem[],
): Promise<void> {
  const { to: toF, from } = fmt(to);

  // Strip {{variable}} placeholders from descriptions — Twilio Content API
  // treats them as template variables and rejects with error 21656.
  const cleanItems = items.map((i) => ({
    ...i,
    description: i.description?.replace(/\{\{[^}]+\}\}/g, '…').slice(0, 72),
  }));

  try {
    const content = await twilioClient.content.v1.contents.create({
      friendlyName: `list_${Date.now()}`,
      language: 'en',
      types: {
        'twilio/list-picker': {
          body,
          button: buttonLabel,
          items: cleanItems.map((i) => {
            const item: { id: string; item: string; description?: string } = { id: i.id, item: i.title };
            if (i.description) item.description = i.description;
            return item;
          }),
        },
      } as unknown as Parameters<typeof twilioClient.content.v1.contents.create>[0]['types'],
    });
    await twilioClient.messages.create({ from, to: toF, contentSid: content.sid });
  } catch (err) {
    const e = err as { message?: string; code?: number };
    console.warn('[waListPicker] Content API failed (code:', e.code, '):', e.message, '— falling back to plain text');
    const numbered = cleanItems.map((item, i) =>
      item.description
        ? `${i + 1}. ${item.title}\n    _${item.description}_`
        : `${i + 1}. ${item.title}`
    ).join('\n');
    await twilioClient.messages.create({ from, to: toF, body: `${body}\n\n${numbered}\n\n_輸入數字選擇，例如：1_` });
  }
}

export interface QuickReplyButton {
  id: string;
  title: string;
}

export async function waQuickReply(
  to: string,
  body: string,
  buttons: QuickReplyButton[],
): Promise<void> {
  const { to: toF, from } = fmt(to);

  try {
    const content = await twilioClient.content.v1.contents.create({
      friendlyName: `qr_${Date.now()}`,
      language: 'en',
      types: {
        'twilio/quick-reply': {
          body,
          actions: buttons.map((b) => ({ type: 'QUICK_REPLY', title: b.title, id: b.id })),
        },
      } as unknown as Parameters<typeof twilioClient.content.v1.contents.create>[0]['types'],
    });
    await twilioClient.messages.create({ from, to: toF, contentSid: content.sid });
  } catch (err) {
    console.warn('[waQuickReply] Content API failed, falling back to plain text:', (err as Error).message);
    const opts = buttons.map((b) => `• *${b.title}*`).join('\n');
    await twilioClient.messages.create({ from, to: toF, body: `${body}\n\n${opts}` });
  }
}
