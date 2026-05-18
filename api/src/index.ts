import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { settingsRoutes } from './routes/settings.js';
import { sessionsRoutes } from './routes/sessions.js';
import { benchmarksRoutes } from './routes/benchmarks.js';
import { migrate } from './db/migrate.js';

const app = new Hono();

app.use('*', cors({
  origin: ['http://localhost:5173', 'https://aura.casabero.com', 'http://aura.casabero.com'],
  credentials: true,
}));

app.use('*', logger());

app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

app.route('/api/settings', settingsRoutes);
app.route('/api/sessions', sessionsRoutes);
app.route('/api/benchmarks', benchmarksRoutes);

const port = parseInt(process.env.PORT || '4000');

async function start() {
  try {
    console.log('Running migrations...');
    await migrate();
    console.log('Migrations complete.');
  } catch (err) {
    console.error('Migration failed, continuing anyway:', err);
  }

  console.log(`Aura API starting on port ${port}`);
  serve({ fetch: app.fetch, port });
}

start();
