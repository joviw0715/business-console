-- Migration: add multi-provider support (voice + WhatsApp)
-- Voice provider: 'twilio' | 'freeswitch' | 'auto'
-- WhatsApp provider: 'twilio' | 'meta' | 'auto'

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS voice_provider TEXT NOT NULL DEFAULT 'twilio';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS wa_provider    TEXT NOT NULL DEFAULT 'twilio';

-- FreeSWITCH ESL connection
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fs_esl_host     TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fs_esl_port     INTEGER DEFAULT 8021;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fs_esl_password TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS fs_did_number   TEXT;

-- Meta Cloud API (WhatsApp Business)
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS meta_wa_token           TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS meta_wa_phone_number_id TEXT;
