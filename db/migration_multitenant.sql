-- Multi-tenant account system migration
-- Run this against your PostgreSQL database ONCE.
-- Existing single-tenant data is assigned to the first account (id=1).

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. accounts table
-- ============================================================
CREATE TABLE IF NOT EXISTS accounts (
  id                     SERIAL PRIMARY KEY,
  username               TEXT NOT NULL UNIQUE,
  password_hash          TEXT NOT NULL,
  is_admin               BOOLEAN NOT NULL DEFAULT false,
  display_name           TEXT,

  -- Per-account Twilio credentials (NULL = fall back to admin account → env var)
  twilio_account_sid     TEXT,
  twilio_auth_token      TEXT,
  twilio_phone_number    TEXT,
  twilio_whatsapp_number TEXT,

  -- Per-account AI credentials
  gemini_api_key         TEXT,
  gemini_model           TEXT,

  -- Per-account service URLs
  voice_webhook_url      TEXT,
  webhook_base_url       TEXT,

  -- Per-account settings
  business_name          TEXT NOT NULL DEFAULT '',
  default_area_code      TEXT NOT NULL DEFAULT '+852',
  wa_outbound_enabled    BOOLEAN NOT NULL DEFAULT false,
  wa_inbound_enabled     BOOLEAN NOT NULL DEFAULT false,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Seed accounts
--    IMPORTANT: change these passwords immediately after running.
--    admin123 = existing single-tenant account (owns all current data)
--    admin     = super-admin (manages all accounts)
-- ============================================================
INSERT INTO accounts (username, password_hash, is_admin, display_name)
VALUES
  ('admin123', crypt('admin123', gen_salt('bf', 12)), false, 'Default Account'),
  ('admin',    crypt('admin',    gen_salt('bf', 12)), true,  'System Admin')
ON CONFLICT (username) DO NOTHING;

-- ============================================================
-- 3. Add account_id to all tenant-owned tables
--    DEFAULT 1 assigns all existing data to the admin123 account.
-- ============================================================
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE campaigns SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE campaigns ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE campaigns ALTER COLUMN account_id DROP DEFAULT;

ALTER TABLE hotlines
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE hotlines SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE hotlines ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE hotlines ALTER COLUMN account_id DROP DEFAULT;

ALTER TABLE inbound_calls
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE inbound_calls SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE inbound_calls ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE inbound_calls ALTER COLUMN account_id DROP DEFAULT;

ALTER TABLE knowledge_base
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE knowledge_base SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE knowledge_base ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE knowledge_base ALTER COLUMN account_id DROP DEFAULT;

ALTER TABLE user_templates
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE user_templates SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE user_templates ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE user_templates ALTER COLUMN account_id DROP DEFAULT;

ALTER TABLE campaign_templates
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE campaign_templates SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE campaign_templates ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE campaign_templates ALTER COLUMN account_id DROP DEFAULT;

ALTER TABLE whatsapp_admins
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE whatsapp_admins SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE whatsapp_admins ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE whatsapp_admins ALTER COLUMN account_id DROP DEFAULT;

ALTER TABLE whatsapp_admin_sessions
  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE DEFAULT 1;
UPDATE whatsapp_admin_sessions SET account_id = 1 WHERE account_id IS NULL;
ALTER TABLE whatsapp_admin_sessions ALTER COLUMN account_id SET NOT NULL;
ALTER TABLE whatsapp_admin_sessions ALTER COLUMN account_id DROP DEFAULT;

-- ============================================================
-- 4. Indexes
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_campaigns_account          ON campaigns(account_id);
CREATE INDEX IF NOT EXISTS idx_hotlines_account           ON hotlines(account_id);
CREATE INDEX IF NOT EXISTS idx_inbound_calls_account      ON inbound_calls(account_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_base_account     ON knowledge_base(account_id);
CREATE INDEX IF NOT EXISTS idx_user_templates_account     ON user_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_account ON campaign_templates(account_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_admins_account    ON whatsapp_admins(account_id);
