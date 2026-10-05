import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { requireApiToken, envTokenProvider, type TokenProvider } from './auth.js';
import { getDb, type DbProvider } from './db.js';
import { createSettingsRoutes } from './routes/settings.js';
import { createSessionsRoutes } from './routes/sessions.js';
import { createBenchmarksRoutes } from './routes/benchmarks.js';

export const ALLOWED_ORIGINS = ['http://localhost:5173', 'https://aura.casabero.com'];

export interface AppOptions {
  db?: DbProvider;
  getToken?: TokenProvider;
  log?: boolean;
}

export function createApp(options: AppOptions = {}) {
  const db = options.db ?? getDb;
  const app = new Hono();

  app.use('*', cors({
    origin: ALLOWED_ORIGINS,
    credentials: true,
  }));

  if (options.log !== false) app.use('*', logger());

  // Public liveness probe (Coolify healthcheck). Returns no stored data.
  app.get('/health', (c) => c.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // Every /api route either returns stored data or mutates it: all require the token.
  app.use('/api/*', requireApiToken(options.getToken ?? envTokenProvider));

  app.route('/api/settings', createSettingsRoutes(db));
  app.route('/api/sessions', createSessionsRoutes(db));
  app.route('/api/benchmarks', createBenchmarksRoutes(db));

  return app;
}
