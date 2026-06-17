import { getWaProviderWithFallback } from './wa-provider';
export type { ListItem, QuickReplyButton } from './wa-provider';

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
  const provider = await getWaProviderWithFallback(aid);
  await provider.sendText(to, body);
}

export async function waListPicker(
  to: string,
  body: string,
  buttonLabel: string,
  items: import('./wa-provider').ListItem[],
  accountId?: number,
): Promise<void> {
  const aid = resolveAccountId(to, accountId);
  const provider = await getWaProviderWithFallback(aid);
  await provider.sendList(to, body, buttonLabel, items);
}

export async function waQuickReply(
  to: string,
  body: string,
  buttons: import('./wa-provider').QuickReplyButton[],
  accountId?: number,
): Promise<void> {
  const aid = resolveAccountId(to, accountId);
  const provider = await getWaProviderWithFallback(aid);
  await provider.sendQuickReply(to, body, buttons);
}
