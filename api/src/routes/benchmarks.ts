import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db.js';

export const benchmarksRoutes = new Hono();

const BenchmarkSchema = z.object({
  session_id: z.string().uuid().optional(),
  provider: z.string().min(1).max(50),
  provider_type: z.string().min(1).max(20),
  model: z.string().min(1).max(255),
  temperature: z.number().min(0).max(2).optional(),
  status: z.enum(['pending', 'running', 'completed', 'error', 'unavailable']).default('pending'),
  latency_ms: z.number().int().optional(),
  first_token_ms: z.number().int().optional(),
  tokens_generated: z.number().int().optional(),
  tokens_per_second: z.number().optional(),
  format_compliance: z.boolean().optional(),
  python_script_included: z.boolean().optional(),
  hallucinated_columns: z.array(z.string()).optional(),
  unsupported_claims: z.number().int().default(0),
  evidence_status: z.enum(['planned', 'attempted_failed', 'preliminary_valid', 'formal_valid']).default('planned'),
  composite_score: z.number().optional(),
  error: z.string().optional(),
  dataset_fingerprint: z.string().max(255).optional(),
  web_gpu_available: z.boolean().optional(),
});

benchmarksRoutes.get('/', async (c) => {
  const sessionId = c.req.query('session_id');
  const limit = parseInt(c.req.query('limit') || '100');

  let query = sql`
    SELECT * FROM benchmark_runs
  `;

  if (sessionId) {
    query = sql`
      SELECT * FROM benchmark_runs WHERE session_id = ${sessionId}
    `;
  }

  const benchmarks = await sql`
    SELECT * FROM benchmark_runs
    ${sessionId ? sql`WHERE session_id = ${sessionId}` : sql``}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return c.json({ benchmarks });
});

benchmarksRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const result = await sql`SELECT * FROM benchmark_runs WHERE id = ${id}`;

  if (result.length === 0) {
    return c.json({ error: 'Benchmark not found' }, 404);
  }

  return c.json(result[0]);
});

benchmarksRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = BenchmarkSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const data = parsed.data;

  const result = await sql`
    INSERT INTO benchmark_runs (
      session_id, provider, provider_type, model, temperature, status,
      latency_ms, first_token_ms, tokens_generated, tokens_per_second,
      format_compliance, python_script_included, hallucinated_columns,
      unsupported_claims, evidence_status, composite_score, error,
      dataset_fingerprint, web_gpu_available
    ) VALUES (
      ${data.session_id || null},
      ${data.provider},
      ${data.provider_type},
      ${data.model},
      ${data.temperature || null},
      ${data.status},
      ${data.latency_ms || null},
      ${data.first_token_ms || null},
      ${data.tokens_generated || null},
      ${data.tokens_per_second || null},
      ${data.format_compliance != null ? data.format_compliance : null},
      ${data.python_script_included != null ? data.python_script_included : null},
      ${data.hallucinated_columns ? JSON.stringify(data.hallucinated_columns) : '[]'}::jsonb,
      ${data.unsupported_claims ?? 0},
      ${data.evidence_status},
      ${data.composite_score || null},
      ${data.error || null},
      ${data.dataset_fingerprint || null},
      ${data.web_gpu_available != null ? data.web_gpu_available : null}
    )
    RETURNING *
  `;

  return c.json(result[0], 201);
});

benchmarksRoutes.patch('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  const existing = await sql`SELECT * FROM benchmark_runs WHERE id = ${id}`;
  if (existing.length === 0) {
    return c.json({ error: 'Benchmark not found' }, 404);
  }

  const fields: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const [key, value] of Object.entries(body)) {
    if (value !== undefined && [
      'session_id', 'provider', 'provider_type', 'model', 'temperature',
      'status', 'latency_ms', 'first_token_ms', 'tokens_generated',
      'tokens_per_second', 'format_compliance', 'python_script_included',
      'hallucinated_columns', 'unsupported_claims', 'evidence_status',
      'composite_score', 'error', 'dataset_fingerprint', 'web_gpu_available'
    ].includes(key)) {
      fields.push(`${key} = $${idx}`);
      values.push(typeof value === 'object' ? JSON.stringify(value) : value);
      idx++;
    }
  }

  if (fields.length === 0) {
    return c.json({ error: 'No valid fields to update' }, 400);
  }

  const result = await sql.unsafe(
    `UPDATE benchmark_runs SET ${fields.join(', ')} WHERE id = $${idx} RETURNING *`,
    [...values, id]
  );

  return c.json(result[0]);
});

benchmarksRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  await sql`DELETE FROM benchmark_runs WHERE id = ${id}`;
  return c.json({ deleted: id });
});
