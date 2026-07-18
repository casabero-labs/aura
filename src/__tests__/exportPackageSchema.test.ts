import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildAuraExportPackage } from '../services/exportPackage';
import { buildEvidenceManifest } from '../services/evidenceManifest';
import { AuditReport } from '../types';

interface SchemaNode {
  $ref?: string;
  type?: string | string[];
  const?: unknown;
  enum?: unknown[];
  oneOf?: SchemaNode[];
  anyOf?: SchemaNode[];
  required?: string[];
  properties?: Record<string, SchemaNode>;
  items?: SchemaNode | false;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  additionalProperties?: boolean;
  contains?: SchemaNode;
  not?: SchemaNode;
}

interface TechnicalExportSchema extends SchemaNode {
  $schema: string;
  $id: string;
  title: string;
  $defs?: Record<string, SchemaNode>;
}

const schemaPath = new URL(
  '../../docs/product/aura/contracts/aura-technical-export.schema.json',
  import.meta.url,
);
const schema = JSON.parse(readFileSync(schemaPath, 'utf8')) as TechnicalExportSchema;

const resolve = (node: SchemaNode): SchemaNode => {
  const prefix = '#/$defs/';
  if (!node.$ref?.startsWith(prefix)) {
    return node;
  }

  const definition = schema.$defs?.[node.$ref.slice(prefix.length)];
  if (!definition) {
    throw new Error(`Schema definition missing: ${node.$ref}`);
  }
  return definition;
};

const property = (node: SchemaNode, name: string): SchemaNode => {
  const value = resolve(node).properties?.[name];
  if (!value) {
    throw new Error(`Schema property missing: ${name}`);
  }
  return value;
};

const validates = (inputNode: SchemaNode, value: unknown): boolean => {
  const node = resolve(inputNode);

  if (node.anyOf && !node.anyOf.some((branch) => validates(branch, value))) {
    return false;
  }
  if (node.oneOf && node.oneOf.filter((branch) => validates(branch, value)).length !== 1) {
    return false;
  }
  if (node.const !== undefined && value !== node.const) {
    return false;
  }
  if (node.enum && !node.enum.includes(value)) {
    return false;
  }

  const types = node.type ? (Array.isArray(node.type) ? node.type : [node.type]) : [];
  if (types.length > 0) {
    const matchesType = types.some((type) => {
      if (type === 'null') return value === null;
      if (type === 'array') return Array.isArray(value);
      if (type === 'integer') return typeof value === 'number' && Number.isInteger(value);
      if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
      if (type === 'object') return typeof value === 'object' && value !== null && !Array.isArray(value);
      return typeof value === type;
    });
    if (!matchesType) {
      return false;
    }
  }

  if (typeof value === 'string') {
    if (node.minLength !== undefined && value.length < node.minLength) return false;
    if (node.pattern && !new RegExp(node.pattern).test(value)) return false;
  }
  if (typeof value === 'number') {
    if (node.minimum !== undefined && value < node.minimum) return false;
    if (node.maximum !== undefined && value > node.maximum) return false;
  }
  if (Array.isArray(value) && node.items) {
    if (!value.every((item) => validates(node.items as SchemaNode, item))) return false;
  }

  const isObject = typeof value === 'object' && value !== null && !Array.isArray(value);
  if (isObject && (node.properties || node.required || node.additionalProperties === false)) {
    const record = value as Record<string, unknown>;
    if (node.required?.some((name) => !(name in record))) return false;
    if (node.properties) {
      for (const [name, child] of Object.entries(node.properties)) {
        if (name in record && !validates(child, record[name])) return false;
      }
      if (
        node.additionalProperties === false
        && Object.keys(record).some((name) => !(name in node.properties!))
      ) return false;
    }
  }

  return true;
};

const report: AuditReport = {
  score: 80,
  rowCount: 10,
  colCount: 2,
  duplicateRows: 0,
  issues: [],
  columnStats: {},
  scoreBreakdown: [],
  delimiterDetected: ',',
};

const manifest = buildEvidenceManifest({
  auditEvidence: null,
  benchmarkResults: [],
});

const exported = buildAuraExportPackage({
  manifest,
  profile: {
    report,
    auditEvidence: null,
  },
  deterministicValidation: null,
  hitlDecision: null,
  diagnosis: {
    status: 'valid' as const,
    model: 'test-model',
    providerType: 'ollama',
    diagnosisText: 'Diagnóstico de prueba.',
    structuredDiagnosis: null,
    failureEvidence: null,
    inputSnapshot: null,
    executionReceipt: null,
    rawResponseHash: null,
  },
  script: {
    generatedScript: '',
    scriptValidation: null,
    approvedScript: '',
  },
  benchmarkResults: [],
  improvementRun: null,
});

describe('aura-technical-export JSON Schema', () => {
  it('declara JSON Schema 2020-12 e identifica el contrato 2.1', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toContain('aura-technical-export.schema.json');
    expect(schema.title).toContain('AURA Technical Export 2.1');
  });

  it('valida las restricciones mínimas del paquete generado', () => {
    for (const requiredBlock of schema.required ?? []) {
      expect(exported).toHaveProperty(requiredBlock);
    }
    expect(schema.required).toEqual(expect.arrayContaining([
      'artifactIdentity',
      'diagnosticReport',
    ]));

    const exportContract = property(schema, 'exportContract');
    expect(exported.exportContract.name).toBe(property(exportContract, 'name').const);
    expect(exported.exportContract.version).toBe(property(exportContract, 'version').const);
    expect(exported.exportContract.canonicalBlocks).toContain(
      property(exportContract, 'canonicalBlocks').contains?.const,
    );
    expect(exported.exportContract.canonicalBlocks).toEqual([
      'artifactIdentity',
      'manifest',
      'profile',
      'diagnosis',
      'script',
      'remediationExecution',
      'calibrationEvidence',
    ]);

    const compatibility = property(exportContract, 'compatibility');
    expect(exported.exportContract.compatibility.legacyAliasIncluded).toBe(
      property(compatibility, 'legacyAliasIncluded').const,
    );

    const calibrationEvidence = property(schema, 'calibrationEvidence');
    expect(exported.calibrationEvidence.classification).toBe(
      property(calibrationEvidence, 'classification').const,
    );
    expect(
      property(property(calibrationEvidence, 'summary'), 'status').enum,
    ).toContain(exported.calibrationEvidence.summary.status);
  });

  it('prohíbe experiment como bloque raíz y conserva calibrationEvidence como canónico', () => {
    expect(schema.not?.required).toContain('experiment');
    expect(exported).not.toHaveProperty('experiment');
    expect(exported.exportContract.canonicalBlocks).toContain('calibrationEvidence');

    const serialized = JSON.stringify({ schema, exported }).toLowerCase();
    expect(serialized).not.toContain('production-ready');
    expect(serialized).not.toContain('mejor modelo');
    expect(serialized).not.toContain('ganador universal');
  });

  it('aplica oneOf fail-closed: reaudited vacío no satisface el schema 2.1', () => {
    const remediation = property(schema, 'remediationExecution');
    expect(remediation.oneOf).toHaveLength(5);
    expect(validates(remediation, {
      status: 'reaudited',
      executionBundle: null,
      pythonReceipt: null,
      verification: null,
      correctedDataset: null,
      limitations: [],
    })).toBe(false);
    expect(validates(remediation, {
      status: 'reaudited',
      executionBundle: {},
      pythonReceipt: {},
      verification: {
        contractId: 'aura.remediation-verification.v1',
        contractVersion: '1.0.0',
        executionId: 'execution:test',
        executedAt: '2026-07-18T12:00:00.000Z',
        before: { score: 80, issueCount: 2, rowCount: 10, columnCount: 3 },
        after: { score: 90, issueCount: 1, rowCount: 10, columnCount: 3 },
        findings: { resolved: [], persistent: [], new: [] },
        outcome: 'improved',
        limitations: [],
      },
      correctedDataset: {
        sha256: 'a'.repeat(64),
        rowCount: 10,
        columnCount: 3,
        includedInEvidenceArchive: false,
      },
      limitations: [],
    })).toBe(true);
  });
});
