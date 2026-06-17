import { getAccountCredentials } from './credentials';

export interface ListItem {
  id: string;
  title: string;
  description?: string;
}

export interface QuickReplyButton {
  id: string;
  title: string;
}

export interface WaProvider {
  sendText(to: string, body: string): Promise<void>;
  sendList(to: string, body: string, buttonLabel: string, items: ListItem[]): Promise<void>;
  sendQuickReply(to: string, body: string, buttons: QuickReplyButton[]): Promise<void>;
}

export async function getWaProvider(accountId: number): Promise<WaProvider> {
  const creds = await getAccountCredentials(accountId);
  const provider = creds.waProvider;

  if (provider === 'meta' || (provider === 'auto' && creds.metaWaToken && creds.metaWaPhoneNumberId)) {
    const { MetaWaProvider } = await import('./wa-providers/meta');
    return new MetaWaProvider(creds.metaWaToken, creds.metaWaPhoneNumberId);
  }

  const { TwilioWaProvider } = await import('./wa-providers/twilio');
  return new TwilioWaProvider(accountId, creds);
}

export async function getWaProviderWithFallback(accountId: number): Promise<WaProvider> {
  const creds = await getAccountCredentials(accountId);

  if (creds.waProvider === 'auto' && creds.metaWaToken && creds.metaWaPhoneNumberId) {
    const { MetaWaProvider } = await import('./wa-providers/meta');
    const { TwilioWaProvider } = await import('./wa-providers/twilio');
    const meta = new MetaWaProvider(creds.metaWaToken, creds.metaWaPhoneNumberId);
    const twilio = new TwilioWaProvider(accountId, creds);
    return new FallbackWaProvider(meta, twilio);
  }

  return getWaProvider(accountId);
}

class FallbackWaProvider implements WaProvider {
  constructor(private primary: WaProvider, private fallback: WaProvider) {}

  async sendText(to: string, body: string) {
    try { await this.primary.sendText(to, body); }
    catch (err) {
      console.warn('[wa-provider] primary failed, falling back to Twilio:', (err as Error).message);
      await this.fallback.sendText(to, body);
    }
  }

  async sendList(to: string, body: string, buttonLabel: string, items: ListItem[]) {
    try { await this.primary.sendList(to, body, buttonLabel, items); }
    catch (err) {
      console.warn('[wa-provider] primary list failed, falling back to Twilio:', (err as Error).message);
      await this.fallback.sendList(to, body, buttonLabel, items);
    }
  }

  async sendQuickReply(to: string, body: string, buttons: QuickReplyButton[]) {
    try { await this.primary.sendQuickReply(to, body, buttons); }
    catch (err) {
      console.warn('[wa-provider] primary quick-reply failed, falling back to Twilio:', (err as Error).message);
      await this.fallback.sendQuickReply(to, body, buttons);
    }
  }
}
