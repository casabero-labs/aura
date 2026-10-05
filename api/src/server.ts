export interface StartDeps {
  migrate: () => Promise<void>;
  serve: () => void;
  exit: (code: number) => never | void;
  log?: Pick<Console, 'log' | 'error'>;
}

/** Runs migrations, then starts serving. Exits non-zero if migrations fail. */
export async function start(deps: StartDeps): Promise<boolean> {
  const log = deps.log ?? console;
  try {
    log.log('Running migrations...');
    await deps.migrate();
    log.log('Migrations complete.');
  } catch (err) {
    log.error('Migration failed, refusing to start:', err);
    deps.exit(1);
    return false;
  }
  if (!process.env.AURA_API_TOKEN) {
    log.error('AURA_API_TOKEN is not set: every /api route will respond 503.');
  }
  deps.serve();
  return true;
}
