-- WhatsApp Admin Bot — additive migration (no existing tables altered)

CREATE TABLE IF NOT EXISTS whatsapp_admins (
  id         SERIAL PRIMARY KEY,
  phone      TEXT NOT NULL UNIQUE,   -- E.164 format, e.g. "+85291234567"
  name       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS whatsapp_admin_sessions (
  id               SERIAL PRIMARY KEY,
  admin_phone      TEXT NOT NULL UNIQUE,
  state            TEXT NOT NULL DEFAULT 'idle',
  campaign_id      INT REFERENCES campaigns(id) ON DELETE SET NULL,
  pending_contacts JSONB,            -- extracted contacts not yet committed to contacts table
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_sessions_phone ON whatsapp_admin_sessions(admin_phone);
