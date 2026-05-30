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

// Send a twilio/list-picker message via the Content API
// body: message text shown above the button
// buttonLabel: the tappable button label (e.g. "選擇範本")
// items: up to 10 options
export async function waListPicker(
  to: string,
  body: string,
  buttonLabel: string,
  items: ListItem[],
): Promise<void> {
  const { to: toF, from } = fmt(to);

  // Create a one-off Content resource then send it
  // Note: the wire format uses "twilio/list-picker" as the key, not the camelCase TS type
  const content = await twilioClient.content.v1.contents.create({
    friendlyName: `list_${Date.now()}`,
    language: 'zh',
    variables: {},
    types: {
      'twilio/list-picker': {
        body,
        button: buttonLabel,
        items: items.map((i) => ({ id: i.id, item: i.title, description: i.description ?? '' })),
      },
    } as unknown as Parameters<typeof twilioClient.content.v1.contents.create>[0]['types'],
  });

  await twilioClient.messages.create({
    from,
    to: toF,
    contentSid: content.sid,
  });
}

export interface QuickReplyButton {
  id: string;
  title: string;
}

// Send a twilio/quick-reply message via the Content API
// Up to 3 buttons
export async function waQuickReply(
  to: string,
  body: string,
  buttons: QuickReplyButton[],
): Promise<void> {
  const { to: toF, from } = fmt(to);

  const content = await twilioClient.content.v1.contents.create({
    friendlyName: `qr_${Date.now()}`,
    language: 'zh',
    variables: {},
    types: {
      'twilio/quick-reply': {
        body,
        actions: buttons.map((b) => ({ type: 'QUICK_REPLY', title: b.title, id: b.id })),
      },
    } as unknown as Parameters<typeof twilioClient.content.v1.contents.create>[0]['types'],
  });

  await twilioClient.messages.create({
    from,
    to: toF,
    contentSid: content.sid,
  });
}
