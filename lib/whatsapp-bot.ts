import pool from './db';
import { waReply } from './whatsapp-reply';
import { downloadTwilioMedia } from './whatsapp-image';

const GEMINI_MODEL   = process.env.GEMINI_MODEL   ?? 'gemini-2.5-flash';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? '';
const CONSOLE_BASE_URL = (process.env.CONSOLE_BASE_URL ?? '').replace(/\/$/, '');

// Session idle timeout — draft campaign deleted if admin goes quiet
const SESSION_TIMEOUT_MINUTES = 30;

const VOICES = [
  { id: 'Cantonese_GentleLady', label: 'Gentle Lady' },
  { id: 'Cantonese_BrightBoy',  label: 'Bright Boy'  },
  { id: 'Cantonese_WarmLady',   label: 'Warm Lady'   },
];

const TEMPLATES = [
  { key: 'restaurant',     name: '🍽️ Restaurant'    },
  { key: 'beauty_salon',   name: '💇 Beauty Salon'  },
  { key: 'insurance',      name: '🛡️ Insurance'     },
  { key: 'travel_agency',  name: '✈️ Travel Agency' },
  { key: 'medical_clinic', name: '🏥 Medical Clinic' },
  { key: 'real_estate',    name: '🏠 Real Estate'   },
];

export interface PendingContact {
  name: string;
  phone: string;
  custom_field: string;
}

type BotState =
  | 'idle'
  | 'awaiting_template'
  | 'awaiting_name'
  | 'awaiting_contacts'
  | 'reviewing_contacts'
  | 'awaiting_voice'
  | 'awaiting_greeting'
  | 'awaiting_script'
  | 'awaiting_schedule'
  | 'awaiting_confirm';

interface Session {
  state: BotState;
  campaign_id: number | null;
  pending_contacts: PendingContact[] | null;
}

// ─── DB helpers ────────────────────────────────────────────────────────────────

async function isAdmin(phone: string): Promise<boolean> {
  const { rows } = await pool.query(
    'SELECT 1 FROM whatsapp_admins WHERE phone = $1',
    [phone],
  );
  return rows.length > 0;
}

async function getSession(phone: string): Promise<Session> {
  // Expire stale sessions
  await pool.query(
    `DELETE FROM whatsapp_admin_sessions
     WHERE admin_phone = $1
       AND updated_at < NOW() - INTERVAL '${SESSION_TIMEOUT_MINUTES} minutes'`,
    [phone],
  );
  const { rows } = await pool.query(
    'SELECT state, campaign_id, pending_contacts FROM whatsapp_admin_sessions WHERE admin_phone = $1',
    [phone],
  );
  if (rows.length === 0) return { state: 'idle', campaign_id: null, pending_contacts: null };
  return {
    state: rows[0].state as BotState,
    campaign_id: rows[0].campaign_id ?? null,
    pending_contacts: rows[0].pending_contacts ?? null,
  };
}

async function saveSession(phone: string, patch: Partial<Session>): Promise<void> {
  await pool.query(
    `INSERT INTO whatsapp_admin_sessions (admin_phone, state, campaign_id, pending_contacts, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (admin_phone) DO UPDATE SET
       state            = EXCLUDED.state,
       campaign_id      = EXCLUDED.campaign_id,
       pending_contacts = EXCLUDED.pending_contacts,
       updated_at       = NOW()`,
    [phone, patch.state, patch.campaign_id ?? null, patch.pending_contacts ? JSON.stringify(patch.pending_contacts) : null],
  );
}

async function clearSession(phone: string): Promise<void> {
  await pool.query('DELETE FROM whatsapp_admin_sessions WHERE admin_phone = $1', [phone]);
}

// ─── Contact validation ────────────────────────────────────────────────────────

function validatePhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 && phone.trim().startsWith('+');
}

function formatContactList(contacts: PendingContact[]): string {
  return contacts.map((c, i) => {
    const ok = validatePhone(c.phone);
    const flag = ok ? '✅' : '⚠️';
    const name = c.name || '(no name)';
    const note = c.custom_field ? ` · ${c.custom_field}` : '';
    return `${i + 1}. ${flag} ${name} · ${c.phone}${note}`;
  }).join('\n');
}

// ─── Gemini Vision extraction ─────────────────────────────────────────────────

async function extractContactsFromImage(base64: string, mimeType: string): Promise<PendingContact[]> {
  const prompt = `Extract all contact entries from this image. Each entry should have a name, phone number, and optionally a time/appointment/note field.
Return ONLY a JSON array with no markdown, no explanation. Format:
[{"name":"...","phone":"...","custom_field":"..."}]
- phone: include country code if present, keep + prefix (e.g. +85212345678)
- custom_field: appointment time, note, or any other field shown (empty string "" if none)
- Skip rows that have no phone number
- If the image contains a table or list, extract every row`;

  const body = {
    contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
    generationConfig: { temperature: 0, response_mime_type: 'application/json' },
  };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status}`);
  const data = await res.json();
  const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '[]';
  return JSON.parse(raw) as PendingContact[];
}

// ─── Manual contact line parser ───────────────────────────────────────────────
// Accepts: "Name, +85291234567, 7pm"  or  "+85291234567"  (one per line)

function parseManualContacts(text: string): PendingContact[] {
  return text.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length === 1) {
        // Just a phone number
        return { name: '', phone: parts[0], custom_field: '' };
      }
      if (parts.length === 2) {
        return { name: parts[0], phone: parts[1], custom_field: '' };
      }
      return { name: parts[0], phone: parts[1], custom_field: parts.slice(2).join(', ') };
    })
    .filter((c) => c.phone.replace(/\D/g, '').length >= 6);
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────

export interface IncomingMessage {
  from: string;           // E.164, e.g. "+85291234567"  (stripped of "whatsapp:" prefix)
  body: string;
  numMedia: number;
  mediaUrl?: string;
  mediaContentType?: string;
}

export async function handleAdminMessage(msg: IncomingMessage): Promise<void> {
  const phone = msg.from;

  if (!(await isAdmin(phone))) {
    await waReply(phone, '⛔ This WhatsApp number is not authorised. Contact your system administrator.');
    return;
  }

  const session = await getSession(phone);
  const text = msg.body.trim();
  const textLower = text.toLowerCase();

  // Global escape hatch — admin can type "cancel" at any point
  if (textLower === 'cancel' || textLower === 'quit') {
    if (session.campaign_id) {
      // Delete the draft campaign (cascades to campaign_config via FK)
      await pool.query("DELETE FROM campaigns WHERE id = $1 AND status = 'draft'", [session.campaign_id]);
    }
    await clearSession(phone);
    await waReply(phone, '❌ Campaign creation cancelled. Type *new* to start again.');
    return;
  }

  switch (session.state) {
    case 'idle':
      return handleIdle(phone, textLower);

    case 'awaiting_template':
      return handleTemplate(phone, text);

    case 'awaiting_name':
      return handleName(phone, session, text);

    case 'awaiting_contacts':
      return handleContacts(phone, session, msg);

    case 'reviewing_contacts':
      return handleReview(phone, session, text);

    case 'awaiting_voice':
      return handleVoice(phone, session, text);

    case 'awaiting_greeting':
      return handleGreeting(phone, session, text);

    case 'awaiting_script':
      return handleScript(phone, session, text);

    case 'awaiting_schedule':
      return handleSchedule(phone, session, text);

    case 'awaiting_confirm':
      return handleConfirm(phone, session, text);

    default:
      await clearSession(phone);
      return handleIdle(phone, textLower);
  }
}

// ─── State handlers ───────────────────────────────────────────────────────────

async function handleIdle(phone: string, textLower: string): Promise<void> {
  // Accept "new", "新", "start", or any greeting as campaign creation trigger
  if (['new', 'start', 'hi', 'hello', '新', '新活動', '開始'].some((k) => textLower.includes(k))) {
    await saveSession(phone, { state: 'awaiting_template', campaign_id: null, pending_contacts: null });
    const list = TEMPLATES.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
    await waReply(phone,
      `👋 Let's create a campaign!\n\nChoose an industry template (or *0* for none):\n${list}`
    );
  } else {
    await waReply(phone, 'Type *new* to create a campaign.');
  }
}

async function handleTemplate(phone: string, text: string): Promise<void> {
  const n = parseInt(text, 10);
  if (isNaN(n) || n < 0 || n > TEMPLATES.length) {
    const list = TEMPLATES.map((t, i) => `${i + 1}. ${t.name}`).join('\n');
    await waReply(phone, `Please reply with a number 0–${TEMPLATES.length}:\n${list}`);
    return;
  }
  const chosen = n === 0 ? null : TEMPLATES[n - 1];
  // Store template choice in session via pending_contacts field reuse? No — store in DB on campaign creation.
  // We keep it in session state by encoding it in a temporary contacts entry. Cleaner: store as extra JSONB.
  // For simplicity, write a draft campaign now with a placeholder name so we can attach template info.
  await saveSession(phone, {
    state: 'awaiting_name',
    campaign_id: null,
    // Encode template key temporarily in pending_contacts[0].custom_field
    pending_contacts: [{ name: '__template__', phone: '', custom_field: chosen?.key ?? '' }],
  });
  const label = chosen ? `*${chosen.name}* template selected ✅` : 'No template selected';
  await waReply(phone, `${label}\n\nWhat's the campaign name?`);
}

async function handleName(phone: string, session: Session, text: string): Promise<void> {
  if (!text || text.length < 1) {
    await waReply(phone, 'Please enter a campaign name.');
    return;
  }

  // Retrieve template key from the temporary pending_contacts slot
  const templateKey = session.pending_contacts?.[0]?.custom_field ?? null;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO campaigns (name, status) VALUES ($1, 'draft') RETURNING id`,
      [text],
    );
    const campaignId: number = rows[0].id;

    // Load template defaults if selected
    let systemPrompt = '';
    let greetingText = '';
    if (templateKey) {
      try {
        const { TEMPLATES: TPL } = await import('./industry-templates');
        const tpl = TPL[templateKey];
        if (tpl) { systemPrompt = tpl.systemPrompt; greetingText = tpl.greetingText; }
      } catch { /* templates optional */ }
    }

    await client.query(
      `INSERT INTO campaign_config (campaign_id, system_prompt, greeting_text) VALUES ($1, $2, $3)`,
      [campaignId, systemPrompt, greetingText],
    );
    await client.query('COMMIT');

    await saveSession(phone, { state: 'awaiting_contacts', campaign_id: campaignId, pending_contacts: null });
    await waReply(phone,
      `Campaign *"${text}"* created ✅\n\nNow add contacts. You can:\n• Send a *photo* of your contact list\n• Or type contacts (one per line):\n  _Name, +Phone, Note_\n  _+Phone_ (name optional)`
    );
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function handleContacts(phone: string, session: Session, msg: IncomingMessage): Promise<void> {
  let contacts: PendingContact[] = [];

  if (msg.numMedia > 0 && msg.mediaUrl) {
    await waReply(phone, '🔍 Extracting contacts from your image…');
    try {
      const { base64, mimeType } = await downloadTwilioMedia(msg.mediaUrl);
      contacts = await extractContactsFromImage(base64, mimeType);
    } catch (err) {
      await waReply(phone, `❌ Could not extract contacts: ${err instanceof Error ? err.message : String(err)}\n\nTry again or type contacts manually.`);
      return;
    }
    if (contacts.length === 0) {
      await waReply(phone, '⚠️ No contacts found in the image. Try again or type contacts manually.');
      return;
    }
  } else if (msg.body.trim()) {
    contacts = parseManualContacts(msg.body.trim());
    if (contacts.length === 0) {
      await waReply(phone, '⚠️ Could not parse any contacts. Format: _Name, +Phone, Note_ (one per line).');
      return;
    }
  } else {
    await waReply(phone, 'Send a photo or type contacts manually.');
    return;
  }

  await saveSession(phone, { ...session, state: 'reviewing_contacts', pending_contacts: contacts });
  const list = formatContactList(contacts);
  const warnings = contacts.filter((c) => !validatePhone(c.phone)).length;
  const warningNote = warnings > 0
    ? `\n\n⚠️ ${warnings} contact(s) have invalid phone numbers.`
    : '';

  await waReply(phone,
    `Found *${contacts.length}* contact(s):\n\n${list}${warningNote}\n\nCommands:\n• *ok* — confirm and continue\n• *fix N new_value* — fix a field (e.g. _fix 2 +85291234567_ or _fix 2 name John_)\n• *del N* — remove a contact\n• *add Name, +Phone, Note* — add a contact`
  );
}

async function handleReview(phone: string, session: Session, text: string): Promise<void> {
  const contacts = session.pending_contacts ?? [];
  const textLower = text.toLowerCase();

  // ok — confirm
  if (textLower === 'ok' || textLower === 'confirm') {
    const valid = contacts.filter((c) => validatePhone(c.phone));
    const invalid = contacts.filter((c) => !validatePhone(c.phone));

    if (valid.length === 0) {
      await waReply(phone, '❌ No contacts with valid phone numbers. Please fix them first.');
      return;
    }
    if (invalid.length > 0) {
      const names = invalid.map((c, i) => `${contacts.indexOf(c) + 1}. ${c.name || c.phone}`).join(', ');
      await waReply(phone,
        `⚠️ ${invalid.length} contact(s) have invalid phone numbers and will be skipped: ${names}\n\nReply *ok* again to proceed with ${valid.length} valid contact(s), or fix them first.`
      );
      // Mark that user has seen warning — change state so second "ok" proceeds
      await saveSession(phone, { ...session, state: 'reviewing_contacts', pending_contacts: contacts.filter((c) => validatePhone(c.phone)) });
      return;
    }

    // Insert contacts into DB
    if (session.campaign_id) {
      const vals = valid.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(', ');
      const params = valid.flatMap((c) => [
        session.campaign_id,
        c.phone.trim(),
        c.name?.trim() || null,
        c.custom_field?.trim() ? JSON.stringify({ note: c.custom_field.trim() }) : null,
      ]);
      await pool.query(`INSERT INTO contacts (campaign_id, phone, name, custom_data) VALUES ${vals}`, params);
    }

    await saveSession(phone, { ...session, state: 'awaiting_voice', pending_contacts: null });
    const voiceList = VOICES.map((v, i) => `${i + 1}. ${v.label}`).join('\n');
    await waReply(phone, `✅ ${valid.length} contact(s) saved.\n\nChoose AI voice:\n${voiceList}`);
    return;
  }

  // fix N value  OR  fix N name John
  const fixMatch = text.match(/^fix\s+(\d+)\s+(.+)$/i);
  if (fixMatch) {
    const idx = parseInt(fixMatch[1], 10) - 1;
    const value = fixMatch[2].trim();
    if (idx < 0 || idx >= contacts.length) {
      await waReply(phone, `❌ No contact #${idx + 1}. List has ${contacts.length} contact(s).`);
      return;
    }
    const updated = [...contacts];
    // Detect "fix N name John" vs "fix N +85291234567"
    const nameMatch = value.match(/^name\s+(.+)$/i);
    const noteMatch = value.match(/^note\s+(.+)$/i);
    if (nameMatch) {
      updated[idx] = { ...updated[idx], name: nameMatch[1].trim() };
    } else if (noteMatch) {
      updated[idx] = { ...updated[idx], custom_field: noteMatch[1].trim() };
    } else {
      // Treat as phone number replacement
      updated[idx] = { ...updated[idx], phone: value };
    }
    await saveSession(phone, { ...session, pending_contacts: updated });
    await waReply(phone, `Updated:\n\n${formatContactList(updated)}\n\nReply *ok* to confirm or keep fixing.`);
    return;
  }

  // del N
  const delMatch = text.match(/^del\s+(\d+)$/i);
  if (delMatch) {
    const idx = parseInt(delMatch[1], 10) - 1;
    if (idx < 0 || idx >= contacts.length) {
      await waReply(phone, `❌ No contact #${idx + 1}.`);
      return;
    }
    const updated = contacts.filter((_, i) => i !== idx);
    await saveSession(phone, { ...session, pending_contacts: updated });
    if (updated.length === 0) {
      await waReply(phone, 'All contacts removed. Send a photo or type contacts to start over.');
      await saveSession(phone, { ...session, state: 'awaiting_contacts', pending_contacts: null });
    } else {
      await waReply(phone, `Removed. Remaining:\n\n${formatContactList(updated)}\n\nReply *ok* to confirm or keep editing.`);
    }
    return;
  }

  // add Name, +Phone, Note
  const addMatch = text.match(/^add\s+(.+)$/i);
  if (addMatch) {
    const newOnes = parseManualContacts(addMatch[1]);
    if (newOnes.length === 0) {
      await waReply(phone, '⚠️ Could not parse. Format: _add Name, +Phone, Note_');
      return;
    }
    const updated = [...contacts, ...newOnes];
    await saveSession(phone, { ...session, pending_contacts: updated });
    await waReply(phone, `Added. Current list:\n\n${formatContactList(updated)}\n\nReply *ok* to confirm.`);
    return;
  }

  // Unknown input — re-show instructions
  await waReply(phone,
    `Current contacts:\n\n${formatContactList(contacts)}\n\nCommands: *ok* · *fix N value* · *del N* · *add Name, +Phone, Note*`
  );
}

async function handleVoice(phone: string, session: Session, text: string): Promise<void> {
  const n = parseInt(text, 10);
  if (isNaN(n) || n < 1 || n > VOICES.length) {
    const list = VOICES.map((v, i) => `${i + 1}. ${v.label}`).join('\n');
    await waReply(phone, `Please reply 1–${VOICES.length}:\n${list}`);
    return;
  }
  const voice = VOICES[n - 1];
  if (session.campaign_id) {
    await pool.query(
      `UPDATE campaign_config SET voice_id = $1 WHERE campaign_id = $2`,
      [voice.id, session.campaign_id],
    );
  }
  await saveSession(phone, { ...session, state: 'awaiting_greeting' });
  await waReply(phone, `Voice: *${voice.label}* ✅\n\nNow send the *greeting* — the first thing the AI says when the contact picks up:`);
}

async function handleGreeting(phone: string, session: Session, text: string): Promise<void> {
  if (!text.trim()) {
    await waReply(phone, 'Please send the greeting text.');
    return;
  }
  if (session.campaign_id) {
    await pool.query(
      `UPDATE campaign_config SET greeting_text = $1 WHERE campaign_id = $2`,
      [text.trim(), session.campaign_id],
    );
  }
  await saveSession(phone, { ...session, state: 'awaiting_script' });
  await waReply(phone,
    `Greeting saved ✅\n\nNow send the *AI script* — instructions for what the AI should do and say during the call.\n\nTip: use {{name}}, {{date}}, {{time}} to personalise.`
  );
}

async function handleScript(phone: string, session: Session, text: string): Promise<void> {
  if (!text.trim()) {
    await waReply(phone, 'Please send the AI script.');
    return;
  }
  if (text.length > 3500) {
    await waReply(phone, `⚠️ Script is ${text.length} characters. WhatsApp has a 4096-char limit — please shorten it.`);
    return;
  }
  if (session.campaign_id) {
    await pool.query(
      `UPDATE campaign_config SET system_prompt = $1 WHERE campaign_id = $2`,
      [text.trim(), session.campaign_id],
    );
  }
  await saveSession(phone, { ...session, state: 'awaiting_schedule' });
  await waReply(phone,
    `Script saved ✅\n\nWhen to call?\n1. Start immediately\n2. Schedule — reply _2 YYYY-MM-DD HH:MM_\n   e.g. _2 2025-06-15 09:00_`
  );
}

async function handleSchedule(phone: string, session: Session, text: string): Promise<void> {
  if (text.trim() === '1') {
    // Start now — keep scheduled_at null; user launches via confirm
    if (session.campaign_id) {
      await pool.query(`UPDATE campaigns SET scheduled_at = NULL WHERE id = $1`, [session.campaign_id]);
    }
    await saveSession(phone, { ...session, state: 'awaiting_confirm' });
    return showConfirm(phone, session.campaign_id, null);
  }

  const schedMatch = text.match(/^2\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})$/);
  if (schedMatch) {
    const scheduledAt = `${schedMatch[1]}T${schedMatch[2]}:00`;
    if (isNaN(Date.parse(scheduledAt))) {
      await waReply(phone, '❌ Invalid date. Use format: _2 YYYY-MM-DD HH:MM_');
      return;
    }
    if (session.campaign_id) {
      await pool.query(
        `UPDATE campaigns SET scheduled_at = $1, status = 'scheduled' WHERE id = $2`,
        [new Date(scheduledAt).toISOString(), session.campaign_id],
      );
    }
    await saveSession(phone, { ...session, state: 'awaiting_confirm' });
    return showConfirm(phone, session.campaign_id, scheduledAt);
  }

  await waReply(phone, `Reply *1* to start immediately or *2 YYYY-MM-DD HH:MM* to schedule.\ne.g. _2 2025-06-15 09:00_`);
}

async function showConfirm(phone: string, campaignId: number | null, scheduledAt: string | null): Promise<void> {
  if (!campaignId) { await waReply(phone, '❌ Session error. Type *new* to restart.'); return; }

  const { rows } = await pool.query(
    `SELECT c.name, c.status, c.scheduled_at,
            cc.voice_id, cc.greeting_text, cc.system_prompt,
            COUNT(ct.id)::int AS contact_count
     FROM campaigns c
     JOIN campaign_config cc ON cc.campaign_id = c.id
     LEFT JOIN contacts ct ON ct.campaign_id = c.id
     WHERE c.id = $1
     GROUP BY c.id, cc.campaign_id`,
    [campaignId],
  );
  if (rows.length === 0) { await waReply(phone, '❌ Campaign not found. Type *new* to restart.'); return; }

  const r = rows[0];
  const voice = VOICES.find((v) => v.id === r.voice_id)?.label ?? r.voice_id;
  const schedText = scheduledAt
    ? `📅 Scheduled: ${new Date(scheduledAt).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' })}`
    : '⚡ Starts immediately on launch';

  await waReply(phone,
    `📋 *Campaign Summary*\n\n` +
    `Name: *${r.name}*\n` +
    `Contacts: *${r.contact_count}*\n` +
    `Voice: *${voice}*\n` +
    `${schedText}\n\n` +
    `Reply *launch* to confirm or *cancel* to discard.`
  );
}

async function handleConfirm(phone: string, session: Session, text: string): Promise<void> {
  const textLower = text.toLowerCase().trim();

  if (textLower !== 'launch') {
    await waReply(phone, 'Reply *launch* to start the campaign or *cancel* to discard.');
    return;
  }

  if (!session.campaign_id) {
    await waReply(phone, '❌ Session error. Type *new* to restart.');
    return;
  }

  const { rows } = await pool.query(
    `SELECT c.scheduled_at, COUNT(ct.id)::int AS contact_count
     FROM campaigns c
     LEFT JOIN contacts ct ON ct.campaign_id = c.id
     WHERE c.id = $1
     GROUP BY c.id`,
    [session.campaign_id],
  );
  if (rows.length === 0) {
    await waReply(phone, '❌ Campaign not found. Type *new* to restart.');
    return;
  }

  const { scheduled_at, contact_count } = rows[0];
  const newStatus = scheduled_at ? 'scheduled' : 'running';
  await pool.query(`UPDATE campaigns SET status = $1 WHERE id = $2`, [newStatus, session.campaign_id]);

  await clearSession(phone);

  const link = CONSOLE_BASE_URL ? `\n\nView: ${CONSOLE_BASE_URL}/campaigns/${session.campaign_id}` : '';
  const statusText = scheduled_at
    ? `scheduled for ${new Date(scheduled_at).toLocaleString('en-HK', { timeZone: 'Asia/Hong_Kong' })}`
    : 'started immediately';

  await waReply(phone,
    `🚀 Campaign launched! ${contact_count} call(s) ${statusText}.${link}\n\nType *new* to create another.`
  );
}
