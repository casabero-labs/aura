import { Hono } from 'hono';
import { z } from 'zod';
import { sql } from '../db.js';

export const settingsRoutes = new Hono();

const SettingsSchema = z.object({
  key: z.string().min(1).max(255),
  value: z.record(z.unknown()),
});

settingsRoutes.get('/', async (c) => {
  const settings = await sql`SELECT key, value, updated_at FROM user_settings ORDER BY key`;
  return c.json({ settings });
});

settingsRoutes.get('/:key', async (c) => {
  const key = c.req.param('key');
  const result = await sql`SELECT key, value, updated_at FROM user_settings WHERE key = ${key}`;

  if (result.length === 0) {
    return c.json({ error: 'Setting not found' }, 404);
  }

  return c.json(result[0]);
});

settingsRoutes.post('/', async (c) => {
  const body = await c.req.json();
  const parsed = SettingsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json({ error: 'Invalid input', details: parsed.error.flatten() }, 400);
  }

  const { key, value } = parsed.data;

  const result = await sql`
    INSERT INTO user_settings (key, value)
    VALUES (${key}, ${JSON.stringify(value)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
    RETURNING key, value, updated_at
  `;

  return c.json(result[0], 201);
});

settingsRoutes.delete('/:key', async (c) => {
  const key = c.req.param('key');
  await sql`DELETE FROM user_settings WHERE key = ${key}`;
  return c.json({ deleted: key });
});
