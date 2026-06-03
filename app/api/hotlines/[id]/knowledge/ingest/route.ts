import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import axios from 'axios';
import { QdrantClient } from '@qdrant/js-client-rest';

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
  const res = await axios.post(url, {
    input: text,
    model: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  return res.data.data[0].embedding;
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let title: string;
  let text: string;

  const contentType = req.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    title = (form.get('title') as string) || 'Untitled';
    const file = form.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { PDFParse } = (await import('pdf-parse')) as any;
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    text = parsed.text;
  } else {
    const body = await req.json();
    title = body.title || 'Untitled';
    text = body.text;
    if (!text?.trim()) return NextResponse.json({ error: 'text is required' }, { status: 400 });
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
        `INSERT INTO knowledge_base (hotline_id, title, content, qdrant_point_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING`,
        [parseInt(id), `${title} (chunk ${i + 1})`, chunks[i], pointId],
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
