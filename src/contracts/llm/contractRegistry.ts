/**
 * Contract Registry — Fase 1.
 *
 * Central registry of all Contracts v2 identifiers.
 * Each contract has: contractId, version, taskType, schema, compatibility, validation.
 */

import type {
  ContractId,
  ContractMetadata,
  CompatibilityDescriptor,
  ValidationResultSummary,
} from './types';

const CONTRACTS_V2_COMPATIBILITY = '2.0';

const COMPAT: CompatibilityDescriptor = {
  minContractsVersion: '2.0.0',
  maxContractsVersion: '2.x',
  breaks: [],
  migrations: ['v1 scripts use column names; v2 uses columnId'],
};

const CURRENT_ISO = new Date().toISOString();

/** All registered Contracts v2. */
export const REGISTRY: Record<ContractId, ContractMetadata> = {
  'aura.evidence.v2': {
    contractId: 'aura.evidence.v2',
    version: '2.0.0',
    taskType: 'evidence',
    schema: {
      required: [
        'contractId', 'contractVersion', 'untrustedContent',
        'datasetFingerprint', 'privacyPolicy', 'datasetSummary',
        'columns', 'issues', 'evidence',
        'selectionManifest', 'truncationManifest',
      ],
    },
    createdAt: CURRENT_ISO,
    compatibility: COMPAT,
    validationResult: { valid: true, errors: [], warnings: [] },
  },

  'aura.diagnosis.v2': {
    contractId: 'aura.diagnosis.v2',
    version: '2.0.0',
    taskType: 'diagnosis',
    schema: {
      required: [
        'contractId', 'contractVersion',
        'evidenceEnvelopeRef', 'issues', 'diagnosisBlocks',
      ],
    },
    createdAt: CURRENT_ISO,
    compatibility: COMPAT,
    validationResult: { valid: true, errors: [], warnings: [] },
  },

  'aura.remediation.v2': {
    contractId: 'aura.remediation.v2',
    version: '2.0.0',
    taskType: 'remediation',
    schema: {
      required: [
        'contractId', 'contractVersion',
        'diagnosisRef', 'plan', 'actionabilityMap',
      ],
    },
    createdAt: CURRENT_ISO,
    compatibility: COMPAT,
    validationResult: { valid: true, errors: [], warnings: [] },
  },

  'aura.script.v2': {
    contractId: 'aura.script.v2',
    version: '2.0.0',
    taskType: 'script',
    schema: {
      required: [
        'contractId', 'contractVersion',
        'remediationRef', 'cleanDatasetFn', 'columnRefs',
        'scriptText',
      ],
    },
    createdAt: CURRENT_ISO,
    compatibility: COMPAT,
    validationResult: { valid: true, errors: [], warnings: [] },
  },
};

/**
 * Look up a contract by ID.
 */
export function getContract(id: ContractId): ContractMetadata | undefined {
  return REGISTRY[id];
}

/**
 * Check if a contract ID is registered.
 */
export function isRegisteredContract(id: string): id is ContractId {
  return id in REGISTRY;
}

/**
 * Get all registered contract IDs.
 */
export function listContracts(): ContractId[] {
  return Object.keys(REGISTRY) as ContractId[];
}

/**
 * Validate a payload against a contract's schema.
 * Returns structured errors for missing required fields.
 */
export function validateAgainstContract(
  contractId: ContractId,
  payload: Record<string, unknown>,
): ValidationResultSummary {
  const contract = REGISTRY[contractId];
  if (!contract) {
    return { valid: false, errors: [`Unknown contract: ${contractId}`], warnings: [] };
  }

  const required = (contract.schema as { required: string[] }).required || [];
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const field of required) {
    if (!(field in payload)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (payload.contractId && payload.contractId !== contractId) {
    errors.push(`contractId mismatch: expected ${contractId}, got ${payload.contractId}`);
  }

  if (payload.contractVersion !== contract.version) {
    warnings.push(`contractVersion mismatch: expected ${contract.version}, got ${payload.contractVersion}`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Feature flag gate for Contracts v2.
 * Returns true only when CONTRACTS_V2_ENABLED is explicitly 'true'.
 * Safe for both browser (Vite) and Node (process.env) environments.
 */
export function isContractsV2Enabled(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      return import.meta.env.VITE_CONTRACTS_V2_ENABLED === 'true';
    }
  } catch {
    // import.meta not available (Node.js)
  }
  return process.env.CONTRACTS_V2_ENABLED === 'true';
}
