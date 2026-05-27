import pool from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      async function push() {
        try {
          const { rows } = await pool.query(
            `SELECT id, call_sid, caller_phone, started_at, escalated,
                    EXTRACT(EPOCH FROM (NOW() - started_at))::int AS duration_sec
             FROM inbound_calls
             WHERE hotline_id = $1 AND ended_at IS NULL
             ORDER BY started_at ASC`,
            [id],
          );
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(rows)}\n\n`));
        } catch {
          controller.enqueue(encoder.encode(`data: []\n\n`));
        }
      }

      await push();
      const interval = setInterval(push, 3000);

      // Clean up on disconnect
      setTimeout(() => {
        clearInterval(interval);
        controller.close();
      }, 5 * 60 * 1000); // max 5 min SSE session
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
