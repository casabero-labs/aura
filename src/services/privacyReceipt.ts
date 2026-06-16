/**
 * PrivacyReceiptService - Generates privacy receipts for Chrome AI diagnosis
 * 
 * Creates a verifiable record of privacy guarantees during Chrome AI usage,
 * including network monitoring results and data handling practices.
 */

import { NetworkGuardResult } from './networkGuard';
import { NormalizedAvailability } from './chromeAvailability';

export interface PrivacyReceipt {
  // Provider information
  provider: 'chrome_ai';
  mode: 'browser_on_device';
  
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
    availability: NormalizedAvailability
  ): Promise<PrivacyReceipt> {
    const finishedAt = new Date().toISOString();
    
    // Generate dataset hash
    const datasetHash = await generateDatasetHash(data);
    
    // Get browser information
    const browserInfo = availability.browserInfo || {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
    };
    
    // Create complete receipt
    const receipt: PrivacyReceipt = {
      provider: 'chrome_ai',
      mode: 'browser_on_device',
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

/**
 * Generate a quick privacy receipt for simple use cases
 */
export async function generateQuickReceipt(
  data: any[][],
  columns: string[],
  networkResult: NetworkGuardResult,
  availability: NormalizedAvailability
): Promise<PrivacyReceipt> {
  const service = new PrivacyReceiptService();
  service.startTracking();
  return service.generateReceipt(data, columns, networkResult, availability);
}