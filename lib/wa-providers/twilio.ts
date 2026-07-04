import { getTwilioClient } from '@/lib/twilio';
import type { AccountCredentials } from '@/lib/credentials';
import type { WaProvider, ListItem, QuickReplyButton, BookingTemplateVars } from '@/lib/wa-provider';

const DEFAULT_WA_TEMPLATE_SID = 'HXdb85837944bae97750c73ab1e169e988';

export class TwilioWaProvider implements WaProvider {
  private accountId: number;
  private creds: AccountCredentials;

  constructor(accountId: number, creds: AccountCredentials) {
    this.accountId = accountId;
    this.creds = creds;
  }

  private fmt(num: string): string {
    return num.startsWith('whatsapp:') ? num : `whatsapp:${num}`;
  }

  private get from(): string {
    return this.fmt(this.creds.twilioWhatsappNumber);
  }

  async sendText(to: string, body: string): Promise<void> {
    const client = await getTwilioClient(this.accountId);
    await client.messages.create({ from: this.from, to: this.fmt(to), body });
  }

  async sendList(to: string, body: string, buttonLabel: string, items: ListItem[]): Promise<void> {
    const client = await getTwilioClient(this.accountId);
    const toF = this.fmt(to);

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
      await client.messages.create({ from: this.from, to: toF, contentSid: content.sid });
    } catch (err) {
      const e = err as { message?: string; code?: number };
      console.warn('[TwilioWaProvider] Content API failed (code:', e.code, '):', e.message, '— falling back to plain text');
      const numbered = cleanItems.map((item, i) =>
        item.description
          ? `${i + 1}. ${item.title}\n    _${item.description}_`
          : `${i + 1}. ${item.title}`
      ).join('\n');
      await client.messages.create({ from: this.from, to: toF, body: `${body}\n\n${numbered}\n\n_輸入數字選擇，例如：1_` });
    }
  }

  async sendQuickReply(to: string, body: string, buttons: QuickReplyButton[]): Promise<void> {
    const client = await getTwilioClient(this.accountId);
    const toF = this.fmt(to);

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
      await client.messages.create({ from: this.from, to: toF, contentSid: content.sid });
    } catch (err) {
      console.warn('[TwilioWaProvider] Content API failed, falling back to plain text:', (err as Error).message);
      const opts = buttons.map((b) => `• *${b.title}*`).join('\n');
      await client.messages.create({ from: this.from, to: toF, body: `${body}\n\n${opts}` });
    }
  }

  async sendBookingTemplate(to: string, vars: BookingTemplateVars): Promise<void> {
    const client = await getTwilioClient(this.accountId);
    await client.messages.create({
      from: this.from,
      to: this.fmt(to),
      contentSid: DEFAULT_WA_TEMPLATE_SID,
      contentVariables: JSON.stringify({
        restaurant: vars.restaurant || '餐廳',
        customer:   vars.customer   || '客人',
        status:     vars.status     || '確認',
        date:       vars.date       || '-',
        time:       vars.time       || '-',
        people:     vars.people     || '-',
      }),
    });
  }
}
