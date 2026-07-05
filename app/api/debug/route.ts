import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET() {
  await requireAdmin();
  try {
    const [dbName, tables] = await Promise.all([
      pool.query('SELECT current_database() AS db, current_schema() AS schema'),
      pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `),
    ]);

    return NextResponse.json({
      connected_to: dbName.rows[0],
      tables: tables.rows.map((r: { table_name: string }) => r.table_name),
      has_hotlines: tables.rows.some((r: { table_name: string }) => r.table_name === 'hotlines'),
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
