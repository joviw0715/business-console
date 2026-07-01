import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const accountId = parseInt(id);

  const url = new URL(req.url);
  const days = parseInt(url.searchParams.get('days') ?? '30');

  const [
    accountRow,
    hotlines,
    campaigns,
    inboundStats,
    outboundStats,
    dailyTrend,
    recentCalls,
  ] = await Promise.all([
    // Account credentials health
    pool.query(
      `SELECT username, display_name, is_admin, created_at,
              twilio_account_sid, twilio_auth_token, twilio_phone_number,
              twilio_whatsapp_number, gemini_api_key, gemini_model,
              voice_webhook_url, webhook_base_url,
              business_name, default_area_code,
              wa_outbound_enabled, wa_inbound_enabled,
              voice_provider, fs_esl_host, fs_esl_port, fs_esl_password, fs_did_number
       FROM accounts WHERE id = $1`,
      [accountId],
    ),

    // Hotlines summary
    pool.query(
      `SELECT h.id, h.name, h.twilio_number, h.status, h.created_at,
              COUNT(ic.id) FILTER (WHERE ic.ended_at IS NULL) AS live_count,
              COUNT(ic.id) AS total_calls,
              COUNT(kb.id) AS kb_items,
              hc.qdrant_collection
       FROM hotlines h
       LEFT JOIN inbound_calls ic ON ic.hotline_id = h.id
       LEFT JOIN knowledge_base kb ON kb.hotline_id = h.id
       LEFT JOIN hotline_config hc ON hc.hotline_id = h.id
       WHERE h.account_id = $1
       GROUP BY h.id, hc.qdrant_collection
       ORDER BY h.created_at DESC`,
      [accountId],
    ),

    // Campaigns summary
    pool.query(
      `SELECT c.id, c.name, c.status, c.created_at,
              COUNT(ct.id)::int AS total_contacts,
              COUNT(ct.id) FILTER (WHERE ct.status = 'done')::int AS done_contacts,
              COUNT(ct.id) FILTER (WHERE ct.outcome = 'answered')::int AS answered
       FROM campaigns c
       LEFT JOIN contacts ct ON ct.campaign_id = c.id
       WHERE c.account_id = $1
       GROUP BY c.id
       ORDER BY c.created_at DESC
       LIMIT 20`,
      [accountId],
    ),

    // Inbound stats for date range
    pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE outcome = 'resolved')::int AS resolved,
         COUNT(*) FILTER (WHERE outcome = 'escalated')::int AS escalated,
         COUNT(*) FILTER (WHERE outcome = 'follow_up')::int AS follow_up,
         COUNT(*) FILTER (WHERE outcome = 'missed')::int AS missed,
         COUNT(*) FILTER (WHERE outcome = 'abandoned')::int AS abandoned,
         ROUND(AVG(duration_sec))::int AS avg_duration,
         COUNT(*) FILTER (WHERE sentiment = 'positive')::int AS positive,
         COUNT(*) FILTER (WHERE sentiment = 'negative')::int AS negative
       FROM inbound_calls
       WHERE account_id = $1 AND started_at >= NOW() - ($2 || ' days')::interval`,
      [accountId, days],
    ),

    // Outbound stats for date range
    pool.query(
      `SELECT
         COUNT(cr.id)::int AS total,
         COUNT(cr.id) FILTER (WHERE cr.outcome = 'answered')::int AS answered,
         COUNT(cr.id) FILTER (WHERE cr.outcome = 'voicemail')::int AS voicemail,
         COUNT(cr.id) FILTER (WHERE cr.outcome = 'no_answer')::int AS no_answer,
         COUNT(cr.id) FILTER (WHERE cr.outcome = 'failed')::int AS failed,
         COUNT(cr.id) FILTER (WHERE cr.outcome = 'booking_confirmed')::int AS booking_confirmed,
         ROUND(AVG(cr.duration_sec))::int AS avg_duration,
         COUNT(cr.id) FILTER (WHERE cr.wa_confirmation_sent = true)::int AS wa_sent
       FROM call_reports cr
       JOIN campaigns c ON c.id = cr.campaign_id
       WHERE c.account_id = $1 AND cr.created_at >= NOW() - ($2 || ' days')::interval`,
      [accountId, days],
    ),

    // Daily trend (last N days)
    pool.query(
      `SELECT
         d::date AS date,
         COALESCE(ib.inbound, 0)::int AS inbound,
         COALESCE(ob.outbound, 0)::int AS outbound
       FROM generate_series(
         (NOW() - ($2 || ' days')::interval)::date,
         NOW()::date,
         '1 day'::interval
       ) d
       LEFT JOIN (
         SELECT DATE(started_at) AS day, COUNT(*)::int AS inbound
         FROM inbound_calls WHERE account_id = $1 GROUP BY day
       ) ib ON ib.day = d::date
       LEFT JOIN (
         SELECT DATE(cr.created_at) AS day, COUNT(*)::int AS outbound
         FROM call_reports cr JOIN campaigns c ON c.id = cr.campaign_id
         WHERE c.account_id = $1 GROUP BY day
       ) ob ON ob.day = d::date
       ORDER BY d`,
      [accountId, days],
    ),

    // Recent call history (inbound + outbound combined)
    pool.query(
      `SELECT 'inbound' AS type, ic.id, ic.call_sid, ic.caller_phone AS phone,
              ic.started_at, ic.duration_sec, ic.outcome, ic.sentiment, ic.summary,
              h.name AS source_name
       FROM inbound_calls ic
       JOIN hotlines h ON h.id = ic.hotline_id
       WHERE ic.account_id = $1
       UNION ALL
       SELECT 'outbound' AS type, cr.id, cr.call_sid, ct.phone,
              cr.started_at, cr.duration_sec, cr.outcome, cr.sentiment, cr.summary,
              c.name AS source_name
       FROM call_reports cr
       JOIN contacts ct ON ct.id = cr.contact_id
       JOIN campaigns c ON c.id = cr.campaign_id
       WHERE c.account_id = $1
       ORDER BY started_at DESC
       LIMIT 50`,
      [accountId],
    ),
  ]);

  if (!accountRow.rows[0]) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const account = accountRow.rows[0];

  // Compute setup health
  const credFields = [
    account.twilio_account_sid,
    account.twilio_auth_token,
    account.twilio_phone_number,
    account.gemini_api_key,
    account.voice_webhook_url,
    account.webhook_base_url,
  ];
  const missingCount = credFields.filter((v) => !v).length;
  const setupHealth = missingCount === 0 ? 'ready' : missingCount >= 4 ? 'not_configured' : 'partial';

  return NextResponse.json({
    account: {
      id: accountId,
      username: account.username,
      display_name: account.display_name,
      is_admin: account.is_admin,
      created_at: account.created_at,
      // credentials (values for form pre-fill)
      twilio_account_sid:     account.twilio_account_sid ?? '',
      twilio_auth_token:      account.twilio_auth_token ?? '',
      twilio_phone_number:    account.twilio_phone_number ?? '',
      twilio_whatsapp_number: account.twilio_whatsapp_number ?? '',
      gemini_api_key:         account.gemini_api_key ?? '',
      gemini_model:           account.gemini_model ?? '',
      voice_webhook_url:      account.voice_webhook_url ?? '',
      webhook_base_url:       account.webhook_base_url ?? '',
      // settings
      business_name:          account.business_name ?? '',
      default_area_code:      account.default_area_code ?? '+852',
      wa_outbound_enabled:    account.wa_outbound_enabled ?? false,
      wa_inbound_enabled:     account.wa_inbound_enabled ?? false,
      setup_health:           setupHealth,
    },
    hotlines: hotlines.rows,
    campaigns: campaigns.rows,
    inbound: inboundStats.rows[0],
    outbound: outboundStats.rows[0],
    trend: dailyTrend.rows,
    history: recentCalls.rows,
    days,
  });
}
