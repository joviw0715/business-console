import { getTwilioClient } from './twilio';
import { getAccountCredentials } from './credentials';

// Module-level phone→accountId cache, populated by whatsapp-bot before any calls
const _accountIdCache = new Map<string, number>();
export function setReplyAccountId(phone: string, accountId: number) {
  _accountIdCache.set(phone, accountId);
}

function resolveAccountId(phone: string, explicit?: number): number {
  return explicit ?? _accountIdCache.get(phone) ?? 1;
}

export async function waReply(to: string, body: string, accountId?: number): Promise<void> {
  const aid = resolveAccountId(to, accountId);
  const creds = await getAccountCredentials(aid);
  const FROM = creds.twilioWhatsappNumber;
  const from = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;
  const toF  = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const client = await getTwilioClient(aid);
  await client.messages.create({ from, to: toF, body });
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
  accountId?: number,
): Promise<void> {
  const aid = resolveAccountId(to, accountId);
  const creds = await getAccountCredentials(aid);
  const FROM = creds.twilioWhatsappNumber;
  const from = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;
  const toF  = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const client = await getTwilioClient(aid);

  const cleanItems = items.map((i) => ({
    ...i,
    description: i.description?.replace(/\{\{[^}]+\}\}/g, '…').slice(0, 72),
  }));

  try {
    const content = await client.content.v1.contents.create({
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
      } as unknown as Parameters<typeof client.content.v1.contents.create>[0]['types'],
    });
    await client.messages.create({ from, to: toF, contentSid: content.sid });
  } catch (err) {
    const e = err as { message?: string; code?: number };
    console.warn('[waListPicker] Content API failed (code:', e.code, '):', e.message, '— falling back to plain text');
    const numbered = cleanItems.map((item, i) =>
      item.description
        ? `${i + 1}. ${item.title}\n    _${item.description}_`
        : `${i + 1}. ${item.title}`
    ).join('\n');
    await client.messages.create({ from, to: toF, body: `${body}\n\n${numbered}\n\n_輸入數字選擇，例如：1_` });
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
  accountId?: number,
): Promise<void> {
  const aid = resolveAccountId(to, accountId);
  const creds = await getAccountCredentials(aid);
  const FROM = creds.twilioWhatsappNumber;
  const from = FROM.startsWith('whatsapp:') ? FROM : `whatsapp:${FROM}`;
  const toF  = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;
  const client = await getTwilioClient(aid);

  try {
    const content = await client.content.v1.contents.create({
      friendlyName: `qr_${Date.now()}`,
      language: 'en',
      types: {
        'twilio/quick-reply': {
          body,
          actions: buttons.map((b) => ({ type: 'QUICK_REPLY', title: b.title, id: b.id })),
        },
      } as unknown as Parameters<typeof client.content.v1.contents.create>[0]['types'],
    });
    await client.messages.create({ from, to: toF, contentSid: content.sid });
  } catch (err) {
    console.warn('[waQuickReply] Content API failed, falling back to plain text:', (err as Error).message);
    const opts = buttons.map((b) => `• *${b.title}*`).join('\n');
    await client.messages.create({ from, to: toF, body: `${body}\n\n${opts}` });
  }
}
