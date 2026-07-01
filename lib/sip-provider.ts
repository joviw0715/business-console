import { getAccountCredentials } from './credentials';

export interface SipProvider {
  initiateCall(params: SipCallParams): Promise<string>;
}

export interface SipCallParams {
  to: string;
  contactId: number;
  campaignId: number;
  twimlUrl: string;
  statusCallbackUrl: string;
  amdCallbackUrl: string;
  recordingCallbackUrl: string;
  timeoutSec: number;
}

export async function getSipProvider(accountId: number): Promise<SipProvider | null> {
  const creds = await getAccountCredentials(accountId);

  if (
    (creds.voiceProvider === 'freeswitch' || creds.voiceProvider === 'auto') &&
    creds.fsEslHost && creds.fsEslPassword && creds.fsDidNumber
  ) {
    return new FreeSwitchProvider(creds.fsEslHost, creds.fsEslPort, creds.fsEslPassword, creds.fsDidNumber);
  }

  return null;
}

class FreeSwitchProvider implements SipProvider {
  constructor(
    private host: string,
    private port: number,
    private password: string,
    private did: string,
  ) {}

  async initiateCall(params: SipCallParams): Promise<string> {
    // Dynamically import modesl so it only loads when FreeSWITCH is active
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const esl = require('modesl');

    return new Promise<string>((resolve, reject) => {
      const conn = new esl.Connection(this.host, this.port, this.password, () => {
        const voiceWebhookUrl = process.env.VOICE_WEBHOOK_URL ?? '';
        // nginx proxy on the FreeSWITCH host terminates TLS — use ws:// not wss://
        const fsHost = this.host;
        const streamWsUrl = `ws://${fsHost}:8088/stream-fs`;

        // originate: dial via sip-trunk gateway for external numbers,
        // or directly via internal profile for short extensions (testing)
        const isExtension = /^\d{1,6}$/.test(params.to);
        const dialStr = isExtension
          ? `sofia/internal/${params.to}@${this.host}`
          : `sofia/gateway/sip-trunk/${params.to}`;

        const originateStr =
          `{origination_caller_id_number=${this.did},` +
          `origination_caller_id_name=AI,` +
          `sip_contact_id=${params.contactId},` +
          `sip_campaign_id=${params.campaignId}` +
          `}${dialStr}` +
          ` &park()`;

        conn.api('originate', originateStr, (res: { body: string }) => {
          const body = res.body ?? '';
          if (!body.startsWith('+OK')) {
            conn.disconnect();
            return reject(new Error(`FreeSWITCH originate failed: ${body}`));
          }

          const callUuid = body.split(' ')[1]?.trim() ?? `fs-${params.contactId}`;

          // Start audio_stream via uuid_audio_stream API (application name is invalid in dialplan)
          const streamUrl =
            `${streamWsUrl}?uuid=${callUuid}` +
            `&direction=outbound` +
            `&contactId=${params.contactId}` +
            `&campaignId=${params.campaignId}`;

          conn.api('uuid_audio_stream', `${callUuid} start ${streamUrl} mono 8000`, () => {
            conn.disconnect();
            resolve(callUuid);
          });
        });
      });

      conn.on('error', (err: Error) => {
        reject(new Error(`FreeSWITCH ESL connection error: ${err.message}`));
      });

      setTimeout(() => reject(new Error('FreeSWITCH ESL connection timeout')), 5000);
    });
  }
}
