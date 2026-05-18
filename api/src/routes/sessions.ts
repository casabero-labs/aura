import { Hono } from 'hono';
import { z } from 'zod';
import { getDb } from '../db.js';

export const sessionsRoutes = new Hono();

const SessionSchema = z.object({
  file_name: z.string().max(500).optional(),
  dataset_fingerprint: z.string().min(1).max(255),
  row_count: z.number().int().optional(),
  column_count: z.number().int().optional(),
  score: z.number().int().optional(),
  issue_count: z.number().int().optional(),
  ai_config: z.record(z.unknown()).optional(),
  ai_analysis: z.string().optional(),
  cleaning_script: z.string().optional(),
  approved_script: z.string().optional(),
  evidence: z.record(z.unknown()).optional(),
});

sessionsRoutes.get('/', async (c) => {
  const sql = getDb();
  const limit = parseInt(c.req.query('limit') || '50');
  const offset = parseInt(c.req.query('offset') || '0');

  const sessions = await sql`
    SELECT id, file_name, dataset_fingerprint, row_count, column_count, score, issue_count, created_at, updated_at
    FROM analysis_sessions
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return c.json({ sessions, limit, offset });
});

sessionsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const sql = getDb();
  const result = await sql`SELECT * FROM analysis_sessions WHERE id = ${id}`;

  if (result.length === 0) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json(result[0]);
});

sessionsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = SessionSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;
  const sql = getDb();

  const result = await sql`
    INSERT INTO analysis_sessions (
      file_name, dataset_fingerprint, row_count, column_count, score, issue_count,
      ai_config, ai_analysis, cleaning_script, approved_script, evidence
    ) VALUES (
      ${data.file_name || null},
      ${data.dataset_fingerprint},
      ${data.row_count || null},
      ${data.column_count || null},
      ${data.score || null},
      ${data.issue_count || null},
      ${data.ai_config ? JSON.stringify(data.ai_config) : null}::jsonb,
      ${data.ai_analysis || null},
      ${data.cleaning_script || null},
      ${data.approved_script || null},
      ${data.evidence ? JSON.stringify(data.evidence) : null}::jsonb
    )
    RETURNING *
  `;

  return c.json(result[0], 201);
});

sessionsRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();
  const sql = getDb();

  const existing = await sql`SELECT * FROM analysis_sessions WHERE id = ${id}`;
  if (existing.length === 0) {
    return c.json({ error: 'Session not found' }, 404);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && ['file_name', 'dataset_fingerprint', 'row_count', 'column_count', 'score', 'issue_count', 'ai_config', 'ai_analysis', 'cleaning_script', 'approved_script', 'evidence'].includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      idx++;
    }
  }

  if (fields.length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  fields.push(`updated_at = NOW()`);

  const result = await sql.unsafe(
    `UPDATE analysis_sessions SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...values, id]
  );

  return c.json(result[0]);
});

sessionsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const sql = getDb();
  await sql`DELETE FROM analysis_sessions WHERE id = ${id}`;
  return c.json({ deleted: id });
});
