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
        const streamUrl = `${voiceWebhookUrl.replace(/^https/, 'wss').replace(/^http/, 'ws')}/stream`;

        // originate: dial {to} from {did}, when answered bridge audio to voice-claw-webhook WebSocket
        const originateStr = [
          `{`,
          `origination_caller_id_number=${this.did},`,
          `origination_caller_id_name=AI,`,
          `sip_contact_id=${params.contactId},`,
          `sip_campaign_id=${params.campaignId}`,
          `}sofia/gateway/sip-trunk/${params.to}`,
          ` &audio_stream(${streamUrl})`,
        ].join('');

        conn.api('originate', originateStr, (res: { body: string }) => {
          conn.disconnect();
          const body = res.body ?? '';
          if (body.startsWith('+OK')) {
            const callUuid = body.split(' ')[1]?.trim() ?? `fs-${params.contactId}`;
            resolve(callUuid);
          } else {
            reject(new Error(`FreeSWITCH originate failed: ${body}`));
          }
        });
      });

      conn.on('error', (err: Error) => {
        reject(new Error(`FreeSWITCH ESL connection error: ${err.message}`));
      });

      // Timeout if ESL doesn't connect within 5 seconds
      setTimeout(() => reject(new Error('FreeSWITCH ESL connection timeout')), 5000);
    });
  }
}
