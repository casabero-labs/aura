import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Papa from 'papaparse';
import { runAudit } from '../../src/services/auditEngine.js';

const csvPath = process.argv[2];
if (!csvPath) {
  process.stderr.write('Usage: tsx run_audit_wrapper.ts <csv_path>\n');
  process.exit(1);
}

const csv = readFileSync(csvPath, 'utf-8');
const parsed = Papa.parse(csv, { header: true, dynamicTyping: true, skipEmptyLines: true });
const data = parsed.data as Record<string, any>[];
const fields = parsed.meta.fields || [];

const report = runAudit(data, fields, ',');

process.stdout.write(JSON.stringify(report, null, 2));
