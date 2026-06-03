export type CampaignStatus = 'draft' | 'running' | 'paused' | 'done' | 'scheduled';
export type ContactStatus = 'pending' | 'calling' | 'done' | 'failed' | 'skipped';
export type CallOutcome = 'answered' | 'voicemail' | 'no_answer' | 'busy' | 'failed' | 'booking_confirmed';
export type Sentiment = 'positive' | 'neutral' | 'negative';

export interface Campaign {
  id: number;
  name: string;
  description: string | null;
  status: CampaignStatus;
  created_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  // joined from campaign_config
  system_prompt?: string;
  voice_id?: string;
  max_retries?: number;
  call_timeout_sec?: number;
  greeting_text?: string;
  webhook_url?: string;
  // computed from contacts
  total_contacts?: number;
  called_contacts?: number;
}

export interface Contact {
  id: number;
  campaign_id: number;
  phone: string;
  name: string | null;
  custom_data: Record<string, unknown> | null;
  status: ContactStatus;
  call_sid: string | null;
  called_at: string | null;
  duration_sec: number | null;
  outcome: CallOutcome | null;
  transcript: string | null;
  summary: string | null;
  retry_count: number;
  created_at: string;
}

export interface CampaignConfig {
  campaign_id: number;
  system_prompt: string;
  voice_id: string;
  max_retries: number;
  call_timeout_sec: number;
  greeting_text: string;
  webhook_url: string | null;
}

export interface CallReport {
  id: number;
  contact_id: number;
  campaign_id: number;
  call_sid: string;
  started_at: string;
  ended_at: string | null;
  duration_sec: number | null;
  outcome: CallOutcome | null;
  transcript: string | null;
  summary: string | null;
  sentiment: Sentiment | null;
  key_points: string[] | null;
  created_at: string;
  // joined
  contact_name?: string;
  contact_phone?: string;
}

export interface SessionData {
  isLoggedIn: boolean;
  accountId: number;
  username: string;
  isAdmin: boolean;
  impersonatingAccountId?: number;
  impersonatingUsername?: string;
}
