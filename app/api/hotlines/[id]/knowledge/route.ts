import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAuth, effectiveAccountId } from '@/lib/auth';
import { timingSafeEqual } from 'crypto';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Allow internal service-to-service calls via Bearer token (voice-claw-webhook)
  const authHeader = req.headers.get('authorization') ?? '';
  const bearerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const internalToken = process.env.CONSOLE_API_TOKEN;

  if (bearerToken && internalToken) {
    const provided = Buffer.from(bearerToken);
    const expected = Buffer.from(internalToken);
    const valid = provided.length === expected.length && timingSafeEqual(provided, expected);
    if (valid) {
      // Internal call — return knowledge directly without session check
      const { rows } = await pool.query(
        'SELECT id, title, content, created_at FROM knowledge_base WHERE hotline_id = $1 ORDER BY created_at DESC',
        [id],
      );
      console.log(`[knowledge-api] internal call hotline=${id} returned ${rows.length} articles`);
      return NextResponse.json(rows);
    }
  }

  // Token present but mismatch — log for debugging
  if (bearerToken) {
    console.warn(`[knowledge-api] token mismatch — internalToken ${internalToken ? 'set' : 'MISSING'}`);
  }

  // Normal browser session auth
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);

  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows } = await pool.query(
    'SELECT id, title, content, created_at FROM knowledge_base WHERE hotline_id = $1 ORDER BY created_at DESC',
    [id],
  );
  return NextResponse.json(rows);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;
  let title: unknown, content: unknown;
  try { ({ title, content } = await req.json()); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }

  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [id, accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { rows: [article] } = await pool.query(
    `INSERT INTO knowledge_base (hotline_id, title, content, account_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [id, title, content, accountId],
  );
  return NextResponse.json({ id: article.id }, { status: 201 });
}
