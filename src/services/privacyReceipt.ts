/**
 * Privacy receipts.
 *
 * - `DiagnosisPrivacyReceiptV2` (contract `aura.privacy-receipt.v2`) is the
 *   receipt the product issues for a diagnosis run. It is built ONLY from
 *   evidence of that run: the ingestion evidence (dataset SHA-256, rows,
 *   columns), the V2 input package and execution receipt (prompt/input
 *   hashes, one hash per request for fragmented Gemini Nano runs), the
 *   provider and the network guard result. It never receives dataset rows.
 *   Whatever cannot be known is reported as `null` and listed in `unknowns`
 *   instead of being invented.
 * - `PrivacyReceipt` (v1) and `PrivacyReceiptService` are kept unchanged for
 *   ChromeProvider compatibility.
 */

import { NetworkGuardResult } from './networkGuard';
import { NormalizedAvailability } from './chromeAvailability';
import type { AIConfig, AuditExecutionEvidence } from '../types';
import type { DiagnosisFailureEvidenceV2, DiagnosisExecutionResult, ExecutionReceiptV1 } from '../contracts/llm';

export interface PrivacyReceipt {
  // Provider information
  provider: 'chrome_ai';
  mode: 'browser_on_device';

  // Generation status
  generation_status: 'success' | 'attempted_failed' | 'not_attempted';
  provider_ready_before_run: boolean;
  session_created: boolean;
  generation_method: 'promptStreaming' | 'prompt' | 'failed';

  // Data handling guarantees
  dataset_sent_to_cloud: boolean;
  raw_dataset_sent: boolean;
  prompt_scope: 'structured_findings_only';

  // Data integrity
  dataset_sha256: string;
  rows: number;
  columns: number;

  // Timing
  started_at: string;
  finished_at: string;

  // Network monitoring
  outbound_requests_from_aura: number;
  external_requests_detected: NetworkGuardResult['externalRequests'];

  // Browser information
  browser: {
    userAgent: string;
    platform: string;
    chromeVersion?: string;
  };

  // Verification
  verification_url?: string;
  receipt_id: string;
}

/**
 * Generate SHA-256 hash of dataset for integrity verification
 */
async function generateDatasetHash(data: any[][]): Promise<string> {
  const encoder = new TextEncoder();
  const dataString = JSON.stringify(data);
  const dataBuffer = encoder.encode(dataString);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate unique receipt ID
 */
function generateReceiptId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 10);
  return `receipt_${timestamp}_${random}`;
}

/**
 * PrivacyReceiptService class
 */
export class PrivacyReceiptService {
  private startTime: string | null = null;
  private receipt: Partial<PrivacyReceipt> = {};
  
  /**
   * Start tracking for a new privacy receipt
   */
  startTracking(): void {
    this.startTime = new Date().toISOString();
    this.receipt = {
      provider: 'chrome_ai',
      mode: 'browser_on_device',
      dataset_sent_to_cloud: false,
      raw_dataset_sent: false,
      prompt_scope: 'structured_findings_only',
      started_at: this.startTime,
    };
  }
  
  /**
   * Generate privacy receipt with all available information
   */
  async generateReceipt(
    data: any[][],
    columns: string[],
    networkResult: NetworkGuardResult,
    availability: NormalizedAvailability,
    sessionCreated: boolean = false,
    generationMethod: 'promptStreaming' | 'prompt' | 'failed' = 'failed',
  ): Promise<PrivacyReceipt> {
    const finishedAt = new Date().toISOString();

    // Generate dataset hash
    const datasetHash = await generateDatasetHash(data);

    // Get browser information
    const browserInfo = availability.browserInfo || {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    };

    const providerReady = availability.status === 'ready';
    const generationStatus: PrivacyReceipt['generation_status'] =
      !providerReady ? 'not_attempted' :
      sessionCreated && generationMethod !== 'failed' ? 'success' :
      'attempted_failed';

    // Create complete receipt
    const receipt: PrivacyReceipt = {
      provider: 'chrome_ai',
      mode: 'browser_on_device',
      generation_status: generationStatus,
      provider_ready_before_run: providerReady,
      session_created: sessionCreated,
      generation_method: generationMethod,
      dataset_sent_to_cloud: false,
      raw_dataset_sent: false,
      prompt_scope: 'structured_findings_only',
      dataset_sha256: datasetHash,
      rows: data.length,
      columns: columns.length,
      started_at: this.startTime || finishedAt,
      finished_at: finishedAt,
      outbound_requests_from_aura: networkResult.auraRequests.length,
      external_requests_detected: networkResult.externalRequests,
      browser: browserInfo,
      receipt_id: generateReceiptId(),
    };

    this.receipt = receipt;
    return receipt;
  }
  
  /**
   * Get current receipt (if tracking)
   */
  getCurrentReceipt(): Partial<PrivacyReceipt> | null {
    return this.startTime ? this.receipt : null;
  }
  
  /**
   * Generate a simplified privacy statement for UI display
   */
  generatePrivacyStatement(receipt: PrivacyReceipt): string {
    const externalCount = receipt.external_requests_detected.length;
    
    if (externalCount === 0) {
      return 'AURA no realizó conexiones externas durante el diagnóstico. Todos los datos permanecen en tu dispositivo.';
    } else {
      return `AURA detectó ${externalCount} conexión(es) externa(s) durante el diagnóstico. Estas conexiones no son controladas por AURA y pueden ser requeridas por Chrome AI.`;
    }
  }
  
  /**
   * Get technical details for accordion display
   */
  getTechnicalDetails(receipt: PrivacyReceipt): string[] {
    const details: string[] = [];
    
    details.push(`Proveedor: Chrome AI (Gemini Nano)`);
    details.push(`Modo: Navegador en dispositivo`);
    details.push(`Dataset: ${receipt.rows} filas, ${receipt.columns} columnas`);
    details.push(`Hash SHA-256: ${receipt.dataset_sha256.substring(0, 16)}...`);
    details.push(`Solicitudes externas de AURA: ${receipt.outbound_requests_from_aura}`);
    
    if (receipt.external_requests_detected.length > 0) {
      details.push(`Solicitudes externas detectadas (no controladas por AURA):`);
      receipt.external_requests_detected.forEach((req, i) => {
        details.push(`  ${i + 1}. ${req.type} a ${req.url}`);
      });
    }
    
    details.push(`Navegador: ${receipt.browser.platform}`);
    if (receipt.browser.chromeVersion) {
      details.push(`Versión Chrome: ${receipt.browser.chromeVersion}`);
    }
    
    return details;
  }
  
  /**
   * Verify receipt integrity
   */
  verifyReceipt(receipt: PrivacyReceipt): {
    isValid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];
    
    // Check required fields
    if (!receipt.receipt_id) issues.push('Missing receipt ID');
    if (!receipt.started_at) issues.push('Missing start time');
    if (!receipt.finished_at) issues.push('Missing finish time');
    if (!receipt.dataset_sha256) issues.push('Missing dataset hash');
    
    // Check timing
    if (receipt.started_at && receipt.finished_at) {
      const start = new Date(receipt.started_at);
      const end = new Date(receipt.finished_at);
      if (end < start) {
        issues.push('End time is before start time');
      }
    }
    
    // Check privacy guarantees
    if (receipt.dataset_sent_to_cloud !== false) {
      issues.push('Dataset was sent to cloud (privacy violation)');
    }
    if (receipt.raw_dataset_sent !== false) {
      issues.push('Raw dataset was sent (privacy violation)');
    }
    
    return {
      isValid: issues.length === 0,
      issues,
    };
  }
}

/**
 * Create a new PrivacyReceiptService instance
 */
export function createPrivacyReceiptService(): PrivacyReceiptService {
  return new PrivacyReceiptService();
}

// ── V2: receipt of a real diagnosis run ──────────────────────────────────

export const PRIVACY_RECEIPT_V2_CONTRACT_ID = 'aura.privacy-receipt.v2' as const;

export interface PrivacyReceiptRequestV2 {
  /** Engine issue id for per-issue (fragmented) requests; null for a single request. */
  issueId: string | null;
  /** SHA-256 of the exact prompt sent in this request. */
  promptHash: string;
  /** SHA-256 of the literal model response; null when none was received. */
  rawResponseHash: string | null;
}

export interface DiagnosisPrivacyReceiptV2 {
  contractId: typeof PRIVACY_RECEIPT_V2_CONTRACT_ID;
  contractVersion: '2.0.0';
  receiptId: string;
  issuedAt: string;
  outcome: 'validated' | 'failed';
  dataset: {
    /** SHA-256 of the ingested file; null when the session has no ingestion evidence. */
    sha256: string | null;
    fingerprint: string | null;
    rows: number;
    columns: number;
    truncated: boolean | null;
    source: 'audit_evidence' | 'report';
  };
  provider: {
    type: AIConfig['providerType'];
    label: string;
    requestedModel: string | null;
    observedModel: string | null;
    /** True for providers that run on this device (Chrome AI, Ollama on loopback, WebLLM). */
    onDevice: boolean;
  };
  /** What left AURA towards the model. Null when no request is on record. */
  sent: {
    content: 'aura.input-snapshot.v2';
    inputMode: string;
    includedSections: string[];
    /** Rows are never sent: the V2 package is built from the profile. */
    rawRowsSent: false;
    /** True when `evidence_samples` was included (individual values, redacted or hashed by the privacy policy). */
    includesRedactedSampleValues: boolean;
    inputHash: string;
    promptHash: string;
    promptVersion: string;
    responseSchemaHash: string | null;
    evidenceEnvelopeRef: string;
    executionReceiptHash: string | null;
    requestCount: number;
    requests: PrivacyReceiptRequestV2[];
  } | null;
  network:
    | {
        monitored: true;
        totalRequests: number;
        outboundRequestsFromAura: number;
        externalRequests: Array<{ type: string; url: string; method?: string; timestamp: number }>;
      }
    | { monitored: false; reason: string };
  /** Plain-language list of facts this receipt cannot certify. */
  unknowns: string[];
}

export interface BuildDiagnosisPrivacyReceiptInput {
  providerType: AIConfig['providerType'];
  providerLabel: string;
  requestedModel?: string | null;
  report: { rowCount: number; colCount: number };
  auditEvidence?: Pick<AuditExecutionEvidence, 'datasetSha256' | 'datasetFingerprint' | 'rowsProcessed' | 'columnsProcessed' | 'truncated'> | null;
  /** Exactly one of these describes the run; both null means nothing is on record. */
  diagnosis?: DiagnosisExecutionResult | null;
  failure?: DiagnosisFailureEvidenceV2 | null;
  /** Null when the network guard was not active for this run. */
  networkResult?: NetworkGuardResult | null;
  now?: () => Date;
}

const ON_DEVICE_PROVIDERS = new Set<AIConfig['providerType']>(['chrome', 'ollama', 'webllm_experimental', 'local']);

const requestsFromReceipt = (receipt: ExecutionReceiptV1): PrivacyReceiptRequestV2[] => {
  const fragmented = receipt.fragmentedExecution;
  if (fragmented && fragmented.fragments.length > 0) {
    return fragmented.fragments.map((fragment) => ({
      issueId: fragment.issueId,
      promptHash: fragment.promptHash,
      rawResponseHash: fragment.rawResponseHash || null,
    }));
  }
  return [{ issueId: null, promptHash: receipt.promptHash, rawResponseHash: receipt.rawResponseHash || null }];
};

/**
 * Build the privacy receipt of a diagnosis run from its real evidence.
 * Never pass dataset rows: none of the inputs carry them.
 */
export function buildDiagnosisPrivacyReceipt(input: BuildDiagnosisPrivacyReceiptInput): DiagnosisPrivacyReceiptV2 {
  const unknowns: string[] = [];
  const evidence = input.auditEvidence ?? null;

  const sha256 = evidence?.datasetSha256 || null;
  if (!sha256) unknowns.push('SHA-256 del archivo: la sesión no conserva la evidencia de ingesta.');

  const executionReceipt = input.diagnosis?.executionReceipt ?? input.failure?.executionReceipt ?? null;
  const snapshot = input.diagnosis?.inputSnapshot ?? input.failure?.inputSnapshot ?? null;

  let sent: DiagnosisPrivacyReceiptV2['sent'] = null;
  if (executionReceipt) {
    const requests = requestsFromReceipt(executionReceipt);
    const includedSections = [...executionReceipt.includedSections];
    sent = {
      content: 'aura.input-snapshot.v2',
      inputMode: executionReceipt.effectiveInputMode,
      includedSections,
      rawRowsSent: false,
      includesRedactedSampleValues: includedSections.includes('evidence_samples'),
      inputHash: executionReceipt.inputHash,
      promptHash: executionReceipt.promptHash,
      promptVersion: executionReceipt.promptVersion,
      responseSchemaHash: executionReceipt.responseSchemaHash || null,
      evidenceEnvelopeRef: executionReceipt.evidenceEnvelopeRef,
      executionReceiptHash: executionReceipt.receiptHash || null,
      requestCount: executionReceipt.fragmentedExecution?.requestCount ?? requests.length,
      requests,
    };
  } else if (input.diagnosis && input.diagnosis.promptHash) {
    const includedSections = snapshot ? [...snapshot.includedSections] : [];
    if (!snapshot) unknowns.push('Secciones incluidas: el resultado no conserva el paquete de entrada.');
    unknowns.push('Hash por solicitud: el resultado no incluye recibo de ejecución.');
    sent = {
      content: 'aura.input-snapshot.v2',
      inputMode: input.diagnosis.inputMode ?? snapshot?.inputMode ?? 'desconocido',
      includedSections,
      rawRowsSent: false,
      includesRedactedSampleValues: includedSections.includes('evidence_samples'),
      inputHash: input.diagnosis.inputHash ?? snapshot?.inputHash ?? '',
      promptHash: input.diagnosis.promptHash,
      promptVersion: input.diagnosis.promptVersion,
      responseSchemaHash: snapshot?.responseSchemaHash ?? null,
      evidenceEnvelopeRef: input.diagnosis.evidenceEnvelopeRef,
      executionReceiptHash: null,
      requestCount: 1,
      requests: [{ issueId: null, promptHash: input.diagnosis.promptHash, rawResponseHash: input.diagnosis.rawResponseHash || null }],
    };
  } else {
    unknowns.push('Contenido enviado: no hay recibo de ejecución; no consta qué solicitud llegó al modelo.');
  }

  const observedModel = executionReceipt?.observedModel ?? input.diagnosis?.metrics.model ?? null;
  if (!observedModel) unknowns.push('Modelo observado: el proveedor no informó su identidad.');

  let network: DiagnosisPrivacyReceiptV2['network'];
  if (input.networkResult) {
    network = {
      monitored: true,
      totalRequests: input.networkResult.totalRequests,
      outboundRequestsFromAura: input.networkResult.auraRequests.length,
      externalRequests: input.networkResult.externalRequests.map(({ type, url, method, timestamp }) => ({ type, url, method, timestamp })),
    };
  } else {
    const reason = input.providerType === 'chrome'
      ? 'La vigilancia de red no estuvo activa durante esta ejecución.'
      : 'La vigilancia de red solo se activa con Chrome AI.';
    network = { monitored: false, reason };
    unknowns.push(`Conexiones de red: ${reason}`);
  }

  return {
    contractId: PRIVACY_RECEIPT_V2_CONTRACT_ID,
    contractVersion: '2.0.0',
    receiptId: generateReceiptId(),
    issuedAt: (input.now ?? (() => new Date()))().toISOString(),
    outcome: input.diagnosis ? 'validated' : 'failed',
    dataset: {
      sha256,
      fingerprint: evidence?.datasetFingerprint || null,
      rows: evidence?.rowsProcessed ?? input.report.rowCount,
      columns: evidence?.columnsProcessed ?? input.report.colCount,
      truncated: typeof evidence?.truncated === 'boolean' ? evidence.truncated : null,
      source: evidence ? 'audit_evidence' : 'report',
    },
    provider: {
      type: input.providerType,
      label: input.providerLabel,
      requestedModel: input.requestedModel || executionReceipt?.requestedModel || null,
      observedModel,
      onDevice: ON_DEVICE_PROVIDERS.has(input.providerType),
    },
    sent,
    network,
    unknowns,
  };
}
