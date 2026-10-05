import { serve } from '@hono/node-server';
import { createApp } from './app.js';
import { migrate } from './db/migrate.js';
import { start } from './server.js';

const port = parseInt(process.env.PORT || '4000');
const app = createApp();

void start({
  migrate,
  serve: () => {
    console.log(`Aura API starting on port ${port}`);
    serve({ fetch: app.fetch, port });
  },
  exit: (code) => process.exit(code),
});
