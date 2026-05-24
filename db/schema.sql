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
  webhook_url      TEXT
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
CREATE INDEX IF NOT EXISTS idx_call_reports_campaign ON call_reports(campaign_id);
CREATE INDEX IF NOT EXISTS idx_call_reports_contact  ON call_reports(contact_id);
