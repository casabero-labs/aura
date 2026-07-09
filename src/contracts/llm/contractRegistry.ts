/**
 * Contract Registry — Phase 1B.
 *
 * Fixed `createdAt` (versioned, not runtime-dependent).
 * contractVersion mismatch is an error (not warning).
 * Real schemas with typed properties, not just required arrays.
 */

import type {
  ContractId,
  ContractMetadata,
  CompatibilityDescriptor,
  SchemaV2,
  ValidationResultSummary,
} from './types';

const FIXED_CREATED_AT = '2026-06-24T00:00:00Z';
const TARGET_VERSION = '2.0.0';

const COMPAT: CompatibilityDescriptor = {
  minContractsVersion: '2.0.0',
  maxContractsVersion: '2.x',
  breaks: ['column references use columnId, not raw names'],
  migrations: ['v1 scripts use column names; v2 uses columnId'],
};

function schema(required: string[], properties: Record<string, { type: string; enum?: string[]; format?: string; nullable?: boolean }>): SchemaV2 {
  return { type: 'object', required, properties };
}

function ok(): ValidationResultSummary {
  return { valid: true, errors: [], warnings: [] };
}

export const REGISTRY: Record<ContractId, ContractMetadata> = {
  'aura.evidence.v2': {
    contractId: 'aura.evidence.v2',
    version: TARGET_VERSION,
    taskType: 'evidence',
    schema: schema(
      ['contractId', 'contractVersion', 'untrustedContent', 'datasetFingerprint', 'privacyPolicy', 'datasetSummary', 'columns', 'issues', 'evidence', 'selectionManifest', 'truncationManifest'],
      {
        contractId: { type: 'string', enum: ['aura.evidence.v2'] },
        contractVersion: { type: 'string', enum: ['2.0.0'] },
        untrustedContent: { type: 'boolean', enum: ['true'] },
        datasetFingerprint: { type: 'object' },
        privacyPolicy: { type: 'object' },
        datasetSummary: { type: 'object' },
        columns: { type: 'array' },
        issues: { type: 'array' },
        evidence: { type: 'object' },
        selectionManifest: { type: 'object' },
        truncationManifest: { type: 'object' },
      }
    ),
    createdAt: FIXED_CREATED_AT,
    compatibility: COMPAT,
    validationResult: ok(),
  },

  'aura.diagnosis.v2': {
    contractId: 'aura.diagnosis.v2',
    version: TARGET_VERSION,
    taskType: 'diagnosis',
    schema: schema(
      ['contractId', 'contractVersion', 'evidenceEnvelopeRef', 'responseId', 'issues', 'diagnosisBlocks', 'limitations', 'generatedAt'],
      {
        contractId: { type: 'string', enum: ['aura.diagnosis.v2'] },
        contractVersion: { type: 'string', enum: ['2.0.0'] },
        evidenceEnvelopeRef: { type: 'string' },
        responseId: { type: 'string' },
        issues: { type: 'array' },
        diagnosisBlocks: { type: 'array' },
        visualizations: { type: 'array' },
        limitations: { type: 'array' },
        generatedAt: { type: 'string' },
      }
    ),
    createdAt: FIXED_CREATED_AT,
    compatibility: COMPAT,
    validationResult: ok(),
  },

  'aura.remediation.v2': {
    contractId: 'aura.remediation.v2',
    version: TARGET_VERSION,
    taskType: 'remediation',
    schema: schema(
      ['contractId', 'contractVersion', 'planId', 'diagnosisRef', 'evidenceEnvelopeRef', 'datasetFingerprint', 'plan', 'actionabilityMap', 'exclusions', 'generatedAt'],
      {
        contractId: { type: 'string', enum: ['aura.remediation.v2'] },
        contractVersion: { type: 'string', enum: ['2.0.0'] },
        planId: { type: 'string' },
        diagnosisRef: { type: 'string' },
        evidenceEnvelopeRef: { type: 'string' },
        datasetFingerprint: { type: 'string' },
        plan: { type: 'array' },
        actionabilityMap: { type: 'object' },
        exclusions: { type: 'array' },
        generatedAt: { type: 'string' },
      }
    ),
    createdAt: FIXED_CREATED_AT,
    compatibility: COMPAT,
    validationResult: ok(),
  },

  'aura.script.v2': {
    contractId: 'aura.script.v2',
    version: TARGET_VERSION,
    taskType: 'script',
    schema: schema(
      ['contractId', 'contractVersion', 'remediationRef', 'acceptedActionIds', 'rejectedActionIds', 'rendererVersion', 'scriptHash', 'validationResult', 'columnRefs', 'cleanDatasetFn'],
      {
        contractId: { type: 'string', enum: ['aura.script.v2'] },
        contractVersion: { type: 'string', enum: ['2.0.0'] },
        remediationRef: { type: 'string' },
        acceptedActionIds: { type: 'array' },
        rejectedActionIds: { type: 'array' },
        rendererVersion: { type: 'string' },
        scriptHash: { type: 'string' },
        validationResult: { type: 'object' },
        columnRefs: { type: 'array' },
        cleanDatasetFn: { type: 'string' },
        scriptText: { type: 'string' },
      }
    ),
    createdAt: FIXED_CREATED_AT,
    compatibility: COMPAT,
    validationResult: ok(),
  },
};

export function getContract(id: ContractId): ContractMetadata | undefined {
  return REGISTRY[id];
}

export function isRegisteredContract(id: string): id is ContractId {
  return id in REGISTRY;
}

export function listContracts(): ContractId[] {
  return Object.keys(REGISTRY) as ContractId[];
}

export function validateAgainstContract(
  contractId: ContractId,
  payload: Record<string, unknown>,
): ValidationResultSummary {
  const contract = REGISTRY[contractId];
  if (!contract) {
    return { valid: false, errors: [`Unknown contract: ${contractId}`], warnings: [] };
  }

  const schema = contract.schema;
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of schema.required) {
    if (!(field in payload) || payload[field] === undefined) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (payload.contractId && payload.contractId !== contractId) {
    errors.push(`contractId mismatch: expected ${contractId}, got ${payload.contractId}`);
  }

  if (payload.contractVersion !== contract.version) {
    errors.push(`contractVersion mismatch: expected ${contract.version}, got ${payload.contractVersion}`);
  }

  // Enum validation for properties that have enum constraints
  if (payload.contractId) {
    const prop = schema.properties.contractId;
    if (prop?.enum && !prop.enum.includes(payload.contractId as string)) {
      errors.push(`contractId value not in allowed enum: ${prop.enum.join(', ')}`);
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function isContractsV2Enabled(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_CONTRACTS_V2_ENABLED === 'true';
    }
  } catch { /* not Vite */ }
  try {
    return process.env.CONTRACTS_V2_ENABLED === 'true';
  } catch { /* not Node */ }
  return false;
}
