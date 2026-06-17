import type { WaProvider, ListItem, QuickReplyButton } from '@/lib/wa-provider';

const GRAPH_URL = 'https://graph.facebook.com/v19.0';

export class MetaWaProvider implements WaProvider {
  private token: string;
  private phoneNumberId: string;

  constructor(token: string, phoneNumberId: string) {
    this.token = token;
    this.phoneNumberId = phoneNumberId;
  }

  private stripPrefix(num: string): string {
    return num.startsWith('whatsapp:') ? num.slice(9) : num;
  }

  private async post(body: object): Promise<void> {
    const res = await fetch(`${GRAPH_URL}/${this.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Meta WA API error ${res.status}: ${text}`);
    }
  }

  async sendText(to: string, body: string): Promise<void> {
    await this.post({
      messaging_product: 'whatsapp',
      to: this.stripPrefix(to),
      type: 'text',
      text: { body },
    });
  }

  async sendList(to: string, body: string, buttonLabel: string, items: ListItem[]): Promise<void> {
    // Meta interactive list message (up to 10 items per section)
    await this.post({
      messaging_product: 'whatsapp',
      to: this.stripPrefix(to),
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: body },
        action: {
          button: buttonLabel,
          sections: [{
            title: buttonLabel,
            rows: items.slice(0, 10).map((i) => ({
              id: i.id,
              title: i.title.slice(0, 24),
              ...(i.description ? { description: i.description.slice(0, 72) } : {}),
            })),
          }],
        },
      },
    });
  }

  async sendQuickReply(to: string, body: string, buttons: QuickReplyButton[]): Promise<void> {
    // Meta interactive reply buttons (up to 3 buttons)
    await this.post({
      messaging_product: 'whatsapp',
      to: this.stripPrefix(to),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: { text: body },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: 'reply',
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    });
  }
}
