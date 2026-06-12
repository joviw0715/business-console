import pool from '@/lib/db';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const encoder = new TextEncoder();
  let interval: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      async function push() {
        if (closed) return;
        try {
          const { rows } = await pool.query(
            `SELECT id, call_sid, caller_phone, started_at, escalated, transcript,
                    EXTRACT(EPOCH FROM (NOW() - started_at))::int AS duration_sec
             FROM inbound_calls
             WHERE hotline_id = $1 AND ended_at IS NULL
             ORDER BY started_at ASC`,
            [id],
          );
          if (closed) return;
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(rows)}\n\n`));
        } catch {
          if (!closed) {
            try { controller.enqueue(encoder.encode(`data: []\n\n`)); } catch { /* already closed */ }
          }
        }
      }

      await push();
      interval = setInterval(push, 3000);

      // Clean up on client disconnect
      req.signal.addEventListener('abort', () => {
        closed = true;
        if (interval) clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },

    cancel() {
      closed = true;
      if (interval) clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
