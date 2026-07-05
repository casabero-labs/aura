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
  required?: string[];
  properties?: Record<string, SchemaNode>;
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
    model: 'test-model',
    providerType: 'ollama',
    diagnosisText: 'Diagnóstico de prueba.',
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
  it('declara JSON Schema 2020-12 e identifica el contrato 2.0', () => {
    expect(schema.$schema).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema.$id).toContain('aura-technical-export.schema.json');
    expect(schema.title).toContain('AURA Technical Export 2.0');
  });

  it('valida las restricciones mínimas del paquete generado', () => {
    for (const requiredBlock of schema.required ?? []) {
      expect(exported).toHaveProperty(requiredBlock);
    }

    const exportContract = property(schema, 'exportContract');
    expect(exported.exportContract.name).toBe(property(exportContract, 'name').const);
    expect(exported.exportContract.version).toBe(property(exportContract, 'version').const);
    expect(exported.exportContract.canonicalBlocks).toContain(
      property(exportContract, 'canonicalBlocks').contains?.const,
    );

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
});
