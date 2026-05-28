-- WhatsApp bot v2 — adds language detection + template context to session

ALTER TABLE whatsapp_admin_sessions
  ADD COLUMN IF NOT EXISTS lang        TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS template_key TEXT;
