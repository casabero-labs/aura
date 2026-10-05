import postgres from 'postgres';

export type Sql = ReturnType<typeof postgres>;
export type DbProvider = () => Sql;

let _sql: Sql | null = null;

export function getDb(): Sql {
  if (!_sql) {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    _sql = postgres(dbUrl, {
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return _sql;
}

export { _sql as sql };
