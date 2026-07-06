/**
 * Phase 10 L9 Evidence Harness — Deterministic E2E test data for export validation.
 *
 * Provides pre-computed minimal AuditReport and EvidenceManifest
 * for the synthetic control dataset, enough to build a valid export package
 * through buildEvidenceManifest + buildAuraExportPackage.
 *
 * NO LLM inference, NO real data, NO mocks of core logic.
 * All data is deterministic and reproducible.
 *
 * Usage (E2E test):
 *   import { L9_CONTROL_CSV, L9_ISSUES_CSV } from './fixtures/aura_l9_dataset_control.csv';
 */
export const L9_CONTROL_CSV_CONTENT = `"id","name","score","active"
1,"alpha",85.5,true
2,"beta",92.0,false
3,"gamma",78.3,true
4,"delta",88.7,false
5,"epsilon",91.2,true
`;

export const L9_ISSUES_CSV_CONTENT = `"id","name","score","active"
1,"alpha",85.5,true
2,"beta",92.0,false
3,"gamma",78.3,true
1,"alpha",85.5,true
4,"delta",null,150.0,false
5,"epsilon",91.2,true
`;
