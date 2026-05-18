import { getDb } from '../db.js';

export async function migrate() {
  const sql = getDb();

  await sql`
    CREATE TABLE IF NOT EXISTS user_settings (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      key VARCHAR(255) NOT NULL UNIQUE,
      value JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS analysis_sessions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      file_name VARCHAR(500),
      dataset_fingerprint VARCHAR(255) NOT NULL,
      row_count INTEGER,
      column_count INTEGER,
      score INTEGER,
      issue_count INTEGER,
      ai_config JSONB,
      ai_analysis TEXT,
      cleaning_script TEXT,
      approved_script TEXT,
      evidence JSONB,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS benchmark_runs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      session_id UUID REFERENCES analysis_sessions(id) ON DELETE CASCADE,
      provider VARCHAR(50) NOT NULL,
      provider_type VARCHAR(20) NOT NULL,
      model VARCHAR(255) NOT NULL,
      temperature DECIMAL(3,2),
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      latency_ms INTEGER,
      first_token_ms INTEGER,
      tokens_generated INTEGER,
      tokens_per_second DECIMAL(8,2),
      format_compliance BOOLEAN,
      python_script_included BOOLEAN,
      hallucinated_columns JSONB DEFAULT '[]',
      unsupported_claims INTEGER DEFAULT 0,
      evidence_status VARCHAR(30) DEFAULT 'planned',
      composite_score DECIMAL(5,2),
      error TEXT,
      dataset_fingerprint VARCHAR(255),
      web_gpu_available BOOLEAN,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_fingerprint ON analysis_sessions(dataset_fingerprint);
    CREATE INDEX IF NOT EXISTS idx_benchmarks_session ON benchmark_runs(session_id);
    CREATE INDEX IF NOT EXISTS idx_benchmarks_provider ON benchmark_runs(provider);
  `;

  console.log('Migrations applied successfully');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  migrate().then(() => process.exit(0)).catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}
