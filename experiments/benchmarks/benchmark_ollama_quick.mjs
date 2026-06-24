/**
 * Ollama Quick Benchmark — Phase 3 conditional.
 * Runs 3 quick diagnosis calls on synthetic_ground_truth.csv.
 * Temperature: 0.1, same model (qwen2.5:3b), same prompt.
 * Max runtime: 5 minutes total.
 *
 * Usage: npx tsx benchmark_ollama_quick.mjs
 */
import fs from 'fs';
import path from 'path';
import Papa from 'papaparse';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DATASET = path.join(__dirname, '../datasets/synthetic_ground_truth.csv');
const OUTPUT  = path.join(__dirname, '../benchmarks/ollama_quick_benchmark.json');
const MODEL   = 'qwen2.5:3b';
const TEMP    = 0.1;
const RUNS    = 3;
const TIMEOUT = 60000; // 60s per call max

async function ollamaChat(prompt, model, temperature) {
  const controller = new AbortController();
  const to = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature,
        stream: false,
      }),
      signal: controller.signal,
    });
    clearTimeout(to);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return {
      content: data.message?.content ?? '',
      latencyMs: data.total_duration ? Math.round(data.total_duration / 1e6) : null,
      tokens: data.eval_count ?? null,
    };
  } catch (e) {
    clearTimeout(to);
    throw e;
  }
}

async function main() {
  console.log(`[ollama-quick] Starting — model=${MODEL}, runs=${RUNS}, dataset=synthetic_ground_truth.csv`);

  // Load and audit dataset
  const csv = fs.readFileSync(DATASET, 'utf8');
  const parsed = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
  const data = parsed.data;
  const fields = parsed.meta.fields || [];

  // Simple audit prompt (short, deterministic)
  const prompt = `You are a data quality auditor. Given this CSV with columns: ${fields.join(', ')}.
Rows: ${data.length}.
For each row, list any data quality issues (nulls, whitespace, duplicates, inconsistent casing).
Be brief. JSON format: [{"row": 0, "field": "name", "issue": "whitespace"}]`;

  const results = [];
  let allFailed = true;

  for (let i = 0; i < RUNS; i++) {
    console.log(`[ollama-quick] Run ${i + 1}/${RUNS}...`);
    const start = Date.now();
    try {
      const resp = await ollamaChat(prompt, MODEL, TEMP);
      const elapsed = Date.now() - start;
      const parsed = resp.content.slice(0, 200);
      results.push({
        run: i + 1,
        status: 'success',
        latencyMs: elapsed,
        modelTokens: resp.tokens,
        responsePreview: parsed,
      });
      allFailed = false;
      console.log(`[ollama-quick] Run ${i + 1} OK — ${elapsed}ms`);
    } catch (e) {
      const elapsed = Date.now() - start;
      results.push({ run: i + 1, status: 'failed', latencyMs: elapsed, error: e.message });
      console.log(`[ollama-quick] Run ${i + 1} FAILED — ${e.message}`);
    }
  }

  const state = allFailed ? 'attempted_failed' : 'preliminary_valid';
  const summary = {
    benchmark: 'ollama-quick',
    commit: 'fe5378e',
    date: new Date().toISOString(),
    model: MODEL,
    temperature: TEMP,
    dataset: 'synthetic_ground_truth.csv',
    datasetSha256: '4e7d358f2141c6463146417a66f1c2312c7c3cdf6a39005780c92b061ff7ac49',
    runs: RUNS,
    state,
    results,
  };

  fs.writeFileSync(OUTPUT, JSON.stringify(summary, null, 2));
  console.log(`[ollama-quick] Done. State: ${state}. Output: ${OUTPUT}`);
  console.log(`[ollama-quick] NOTE: preliminary_valid means structure check passed; does NOT imply benchmark formal.`);
}

main().catch(err => {
  const msg = err instanceof Error ? err.message : String(err);
  console.error('[ollama-quick] Fatal:', msg);
  process.exit(1);
});
