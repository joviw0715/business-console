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

export async function waListPicker(
  to: string,
  body: string,
  buttonLabel: string,
  items: ListItem[],
): Promise<void> {
  const { to: toF, from } = fmt(to);

  try {
    const content = await twilioClient.content.v1.contents.create({
      friendlyName: `list_${Date.now()}`,
      language: 'zh_TW',
      variables: {},
      types: {
        'twilio/list-picker': {
          body,
          button: buttonLabel,
          items: items.map((i) => ({ id: i.id, item: i.title, description: i.description ?? '' })),
        },
      } as unknown as Parameters<typeof twilioClient.content.v1.contents.create>[0]['types'],
    });
    await twilioClient.messages.create({ from, to: toF, contentSid: content.sid });
  } catch (err) {
    // Fallback: plain text with numbered list
    console.warn('[waListPicker] Content API failed, falling back to plain text:', (err as Error).message);
    const numbered = items.map((item, i) => `${i + 1}. ${item.title}${item.description ? ' — ' + item.description : ''}`).join('\n');
    await twilioClient.messages.create({ from, to: toF, body: `${body}\n\n${numbered}` });
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
      language: 'zh_TW',
      variables: {},
      types: {
        'twilio/quick-reply': {
          body,
          actions: buttons.map((b) => ({ type: 'QUICK_REPLY', title: b.title, id: b.id })),
        },
      } as unknown as Parameters<typeof twilioClient.content.v1.contents.create>[0]['types'],
    });
    await twilioClient.messages.create({ from, to: toF, contentSid: content.sid });
  } catch (err) {
    // Fallback: plain text listing each option
    console.warn('[waQuickReply] Content API failed, falling back to plain text:', (err as Error).message);
    const opts = buttons.map((b) => `• *${b.title}*`).join('\n');
    await twilioClient.messages.create({ from, to: toF, body: `${body}\n\n${opts}` });
  }
}
