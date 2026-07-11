import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { QdrantClient } from '@qdrant/js-client-rest';
import { requireAuth, effectiveAccountId } from '@/lib/auth';

const EMBEDDING_DIM = parseInt(process.env.EMBEDDING_DIM || '768');

function getQdrantClient() {
  const rawUrl = process.env.QDRANT_URL || 'http://localhost:6333';
  const parsed = new URL(rawUrl);
  const isHttps = parsed.protocol === 'https:';
  const port = parsed.port ? parseInt(parsed.port) : (isHttps ? 443 : 6333);
  return new QdrantClient({
    host: parsed.hostname, port, https: isHttps,
    apiKey: process.env.QDRANT_API_KEY || undefined,
    checkCompatibility: false,
  });
}

async function getEmbedding(text: string): Promise<number[]> {
  const url = process.env.EMBEDDING_API_URL;
  const key = process.env.EMBEDDING_API_KEY;
  if (!url || !key) throw new Error('EMBEDDING_API_URL / EMBEDDING_API_KEY not set');
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small' }),
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return data.data[0].embedding;
}

function chunkText(text: string, chunkWords = 300, overlapWords = 50): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  let i = 0;
  while (i < words.length) {
    chunks.push(words.slice(i, i + chunkWords).join(' '));
    i += chunkWords - overlapWords;
  }
  return chunks;
}

async function ensureCollection(client: QdrantClient, collectionName: string) {
  try {
    await client.getCollection(collectionName);
  } catch {
    await client.createCollection(collectionName, {
      vectors: { size: EMBEDDING_DIM, distance: 'Cosine' },
    });
  }
}

/**
 * Minimal zero-dependency PDF text extractor.
 * Decodes text from BT...ET blocks using Tj, TJ, and quoted-string operators.
 * Works for most text-based PDFs without requiring a worker or native module.
 */
function extractTextFromPdf(buffer: Buffer): string {
  const raw = buffer.toString('latin1');

  // Decode a PDF string token: <hex> or (literal with escape sequences)
  function decodePdfString(token: string): string {
    if (token.startsWith('<')) {
      // Hex string
      const hex = token.slice(1, -1).replace(/\s/g, '');
      let out = '';
      for (let i = 0; i < hex.length; i += 2) {
        const code = parseInt(hex.slice(i, i + 2), 16);
        if (!isNaN(code)) out += String.fromCharCode(code);
      }
      return out;
    }
    // Literal string — handle escape sequences
    return token.slice(1, -1)
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\\\/g, '\\')
      .replace(/\\\(/g, '(')
      .replace(/\\\)/g, ')');
  }

  // Extract all text from BT...ET blocks
  const lines: string[] = [];
  const btBlocks = raw.match(/BT[\s\S]*?ET/g) ?? [];

  for (const block of btBlocks) {
    // Match Tj operator: (string) Tj or <hex> Tj
    const tjMatches = block.match(/(\((?:[^\\()]|\\.)*\)|<[0-9a-fA-F\s]*>)\s*Tj/g) ?? [];
    for (const m of tjMatches) {
      const strToken = m.replace(/\s*Tj$/, '').trim();
      lines.push(decodePdfString(strToken));
    }

    // Match TJ operator: [(str1) gap (str2) ...] TJ
    const tjArrayMatches = block.match(/\[[\s\S]*?\]\s*TJ/g) ?? [];
    for (const m of tjArrayMatches) {
      const inner = m.replace(/\s*TJ$/, '').replace(/^\[/, '').replace(/\]$/, '');
      const tokens = inner.match(/(\((?:[^\\()]|\\.)*\)|<[0-9a-fA-F\s]*>)/g) ?? [];
      lines.push(tokens.map(decodePdfString).join(''));
    }

    // Match ' and " operators (move to next line and show text)
    const quoteMatches = block.match(/(\((?:[^\\()]|\\.)*\)|<[0-9a-fA-F\s]*>)\s*['""]/g) ?? [];
    for (const m of quoteMatches) {
      const strToken = m.replace(/\s*['""]\s*$/, '').trim();
      lines.push(decodePdfString(strToken));
    }
  }

  return lines.join(' ').replace(/\s+/g, ' ').trim();
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  // Require authenticated session and verify hotline ownership
  const session = await requireAuth();
  const accountId = effectiveAccountId(session);
  const { id } = await params;

  const { rows: [hotline] } = await pool.query(
    'SELECT id FROM hotlines WHERE id = $1 AND account_id = $2',
    [parseInt(id), accountId],
  );
  if (!hotline) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let title: string;
  let text: string;

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    title = (form.get('title') as string) || 'Untitled';
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    text = extractTextFromPdf(buffer);

    if (!text.trim()) {
      return NextResponse.json({ error: 'Could not extract text from PDF. The file may be scanned/image-only.' }, { status: 400 });
    }
  } else {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }); }
    title = typeof body.title === 'string' ? body.title : 'Untitled';
    text = typeof body.text === 'string' ? body.text : '';
    if (!text.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const collectionName = `hotline_${id}`;
  const client = getQdrantClient();
  await ensureCollection(client, collectionName);

  const chunks = chunkText(text.trim());
  const results: { chunk: number; ok: boolean; error?: string }[] = [];

  for (let i = 0; i < chunks.length; i++) {
    try {
      const vector = await getEmbedding(chunks[i]);
      const pointId = crypto.randomUUID();

      await client.upsert(collectionName, {
        points: [{
          id: pointId,
          vector,
          payload: { content: chunks[i], title, hotline_id: parseInt(id), chunk_index: i },
        }],
      });

      // Track in knowledge_base table
      await pool.query(
        `INSERT INTO knowledge_base (hotline_id, title, content, qdrant_point_id, account_id)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT DO NOTHING`,
        [parseInt(id), `${title} (chunk ${i + 1})`, chunks[i], pointId, accountId],
      );

      results.push({ chunk: i + 1, ok: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ chunk: i + 1, ok: false, error: msg });
    }
  }

  // Save collection name to hotline_config so TwiML route can pass it to voice webhook
  await pool.query(
    `UPDATE hotline_config SET qdrant_collection = $1 WHERE hotline_id = $2`,
    [collectionName, parseInt(id)],
  );

  const succeeded = results.filter(r => r.ok).length;
  return NextResponse.json({ collection: collectionName, total: chunks.length, succeeded, results });
}
