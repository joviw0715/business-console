-- AI provider selections — stored in existing app_settings key-value table
INSERT INTO app_settings (key, value) VALUES
  ('provider:llm', 'auto'),
  ('provider:tts', 'auto'),
  ('provider:stt', 'auto')
ON CONFLICT (key) DO NOTHING;
