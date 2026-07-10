-- Run this against your PostgreSQL database to set up Phase 1 schema.

CREATE TABLE IF NOT EXISTS campaigns (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  description  TEXT,
  status       TEXT NOT NULL DEFAULT 'draft'
                 CHECK (status IN ('draft','scheduled','running','paused','done')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scheduled_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS campaign_config (
  campaign_id      INT PRIMARY KEY REFERENCES campaigns(id) ON DELETE CASCADE,
  system_prompt    TEXT NOT NULL DEFAULT '',
  voice_id         TEXT NOT NULL DEFAULT 'Cantonese_GentleLady',
  max_retries      INT  NOT NULL DEFAULT 2,
  call_timeout_sec INT  NOT NULL DEFAULT 60,
  greeting_text    TEXT NOT NULL DEFAULT '',
  webhook_url      TEXT,
  concurrency      INT  NOT NULL DEFAULT 3
);

CREATE TABLE IF NOT EXISTS contacts (
  id           SERIAL PRIMARY KEY,
  campaign_id  INT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  phone        TEXT NOT NULL,
  name         TEXT,
  custom_data  JSONB,
  status       TEXT NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','calling','done','failed','skipped')),
  call_sid     TEXT,
  called_at    TIMESTAMPTZ,
  duration_sec INT,
  outcome      TEXT CHECK (outcome IN ('answered','voicemail','no_answer','busy','failed')),
  transcript   TEXT,
  summary      TEXT,
  retry_count  INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_reports (
  id           SERIAL PRIMARY KEY,
  contact_id   INT NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  campaign_id  INT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  call_sid     TEXT NOT NULL,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  duration_sec INT,
  outcome      TEXT CHECK (outcome IN ('answered','voicemail','no_answer','busy','failed')),
  transcript   TEXT,
  summary      TEXT,
  sentiment    TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  key_points   JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_campaign   ON contacts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_contacts_status     ON contacts(campaign_id, status);
CREATE INDEX IF NOT EXISTS idx_contacts_call_sid   ON contacts(call_sid);
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_campaign_phone ON contacts(campaign_id, phone);
CREATE INDEX IF NOT EXISTS idx_call_reports_campaign ON call_reports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_call_reports_contact  ON call_reports(contact_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_call_reports_call_sid ON call_reports(call_sid);

-- Migration: add concurrency column if upgrading from earlier schema
ALTER TABLE campaign_config ADD COLUMN IF NOT EXISTS concurrency INT NOT NULL DEFAULT 3;

-- ============================================================
-- Phase 2: Inbound Hotline Management
-- ============================================================

CREATE TABLE IF NOT EXISTS hotlines (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  twilio_number TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active','paused')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS hotline_config (
  hotline_id              INT PRIMARY KEY REFERENCES hotlines(id) ON DELETE CASCADE,
  system_prompt           TEXT NOT NULL DEFAULT '',
  voice_id                TEXT NOT NULL DEFAULT 'Cantonese_GentleLady',
  max_call_duration_sec   INT  NOT NULL DEFAULT 300,
  business_hours          JSONB NOT NULL DEFAULT '{}',
  after_hours_message     TEXT NOT NULL DEFAULT '',
  webhook_url             TEXT,
  qdrant_collection       TEXT,
  memory_enabled          BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS inbound_calls (
  id           SERIAL PRIMARY KEY,
  hotline_id   INT NOT NULL REFERENCES hotlines(id) ON DELETE CASCADE,
  call_sid     TEXT NOT NULL,
  caller_phone TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at     TIMESTAMPTZ,
  duration_sec INT,
  outcome      TEXT CHECK (outcome IN ('resolved','escalated','missed','abandoned','follow_up')),
  transcript   TEXT,
  summary      TEXT,
  sentiment    TEXT CHECK (sentiment IN ('positive','neutral','negative')),
  escalated    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS knowledge_base (
  id              SERIAL PRIMARY KEY,
  hotline_id      INT NOT NULL REFERENCES hotlines(id) ON DELETE CASCADE,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  qdrant_point_id UUID,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_hotlines_number     ON hotlines(twilio_number);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_hotline ON inbound_calls(hotline_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_inbound_calls_sid ON inbound_calls(call_sid);
CREATE INDEX IF NOT EXISTS idx_kb_hotline          ON knowledge_base(hotline_id);

-- Migration: add after_hours flag for calls received outside business hours
ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS after_hours BOOLEAN NOT NULL DEFAULT false;

-- Migration: allow follow_up outcome for after-hours calls
ALTER TABLE inbound_calls DROP CONSTRAINT IF EXISTS inbound_calls_outcome_check;
ALTER TABLE inbound_calls ADD CONSTRAINT inbound_calls_outcome_check
  CHECK (outcome IN ('resolved','escalated','missed','abandoned','follow_up'));

-- Migration: follow-up status tracking
ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS follow_up_status TEXT
  CHECK (follow_up_status IN ('pending','booking_confirmed','called_back','no_action'));
ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS follow_up_note TEXT;

-- Migration: user-defined templates
CREATE TABLE IF NOT EXISTS user_templates (
  id                   SERIAL PRIMARY KEY,
  name                 TEXT NOT NULL,
  emoji                TEXT NOT NULL DEFAULT '⭐',
  -- outbound
  campaign_name        TEXT,
  greeting_text        TEXT,
  system_prompt        TEXT,
  -- inbound
  hotline_name         TEXT,
  hotline_system_prompt TEXT,
  after_hours_message  TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: campaign templates (reusable voice + script presets)
CREATE TABLE IF NOT EXISTS campaign_templates (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  emoji       TEXT NOT NULL DEFAULT '📋',
  industry    TEXT,
  voice_id    TEXT NOT NULL DEFAULT 'Cantonese_GentleLady',
  script      TEXT NOT NULL DEFAULT '',
  greeting    TEXT NOT NULL DEFAULT '',
  is_builtin  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Migration: extend whatsapp_admin_sessions for new campaign/template creation flows
ALTER TABLE whatsapp_admin_sessions ADD COLUMN IF NOT EXISTS template_db_id INT;
ALTER TABLE whatsapp_admin_sessions ADD COLUMN IF NOT EXISTS campaign_name TEXT;
ALTER TABLE whatsapp_admin_sessions ADD COLUMN IF NOT EXISTS tpl_voice_id TEXT;
ALTER TABLE whatsapp_admin_sessions ADD COLUMN IF NOT EXISTS tpl_lang TEXT;
ALTER TABLE whatsapp_admin_sessions ADD COLUMN IF NOT EXISTS tpl_greeting TEXT;

-- Migration: app_settings for WhatsApp confirmation
CREATE TABLE IF NOT EXISTS app_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL DEFAULT ''
);
INSERT INTO app_settings (key, value) VALUES
  ('business_name',       ''),
  ('wa_outbound_enabled', 'false'),
  ('wa_inbound_enabled',  'false')
ON CONFLICT (key) DO NOTHING;

-- Migration: WhatsApp confirmation on campaign templates
ALTER TABLE campaign_templates ADD COLUMN IF NOT EXISTS wa_confirmation_enabled BOOLEAN NOT NULL DEFAULT false;

-- Migration: WhatsApp confirmation on hotline config
ALTER TABLE hotline_config ADD COLUMN IF NOT EXISTS wa_confirmation_enabled BOOLEAN NOT NULL DEFAULT false;

-- Migration: track WhatsApp confirmation sent on outbound
ALTER TABLE call_reports ADD COLUMN IF NOT EXISTS wa_confirmation_sent BOOLEAN NOT NULL DEFAULT false;

-- Migration: track WhatsApp confirmation sent on inbound + booking details
ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS wa_confirmation_sent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS booking_details JSONB;

-- Migration: add tpl_wa_enabled to whatsapp_admin_sessions for template creation flow
ALTER TABLE whatsapp_admin_sessions ADD COLUMN IF NOT EXISTS tpl_wa_enabled BOOLEAN;

-- Migration: recording URL + AI-extracted booking fields on call_reports
ALTER TABLE call_reports ADD COLUMN IF NOT EXISTS recording_url TEXT;
ALTER TABLE call_reports ADD COLUMN IF NOT EXISTS booking_date TEXT;
ALTER TABLE call_reports ADD COLUMN IF NOT EXISTS booking_time TEXT;
ALTER TABLE call_reports ADD COLUMN IF NOT EXISTS booking_party_size TEXT;

-- Migration: recording URL on inbound_calls
ALTER TABLE inbound_calls ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Migration: store template reference on campaigns for WA confirmation lookup
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS campaign_template_id INT REFERENCES campaign_templates(id) ON DELETE SET NULL;
