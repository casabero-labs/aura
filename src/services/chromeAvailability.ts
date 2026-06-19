/**
 * Chrome AI Availability Normalizer
 * 
 * Normalizes Chrome AI availability statuses across different API surfaces
 * into a consistent set of statuses for the UX.
 */

export type NormalizedStatus = 
  | 'ready'           // available/readily
  | 'downloadable'    // downloadable/after-download
  | 'downloading'     // downloading in progress
  | 'unavailable'     // unavailable/no
  | 'api_missing'     // no API detected
  | 'error';          // error during detection

export interface NormalizedAvailability {
  status: NormalizedStatus;
  apiSurface: 'LanguageModel' | 'window.ai.languageModel' | 'window.ai.assistant' | 'none';
  message: string;
  technicalDetails: string[];
  browserInfo?: {
    userAgent: string;
    platform: string;
    chromeVersion?: string;
  };
  /** Raw value returned by clean availability() call (no options) */
  availabilityRaw?: string;
  /** Whether clean call was used as primary method */
  availabilityCallMode?: 'clean';
  /** Timestamp of when this detection was performed */
  detectedAt: string;
}

/**
 * Extract availability value from LanguageModel.availability() result.
 * Handles both formats:
 * - String direct: "available", "downloadable", "downloading", "unavailable"
 * - Object legacy/experimental: { available: "available" } or { status: "available" }
 * 
 * @param result - Raw result from availability() call
 * @returns Normalized string value or undefined if无法 extract
 */
export function extractAvailabilityValue(result: unknown): string | undefined {
  if (result === null || result === undefined) {
    return undefined;
  }
  
  // If result is a string, return it directly
  if (typeof result === 'string') {
    return result;
  }
  
  // If result is an object, try to extract from .available or .status
  if (typeof result === 'object') {
    const obj = result as Record<string, unknown>;
    
    // Try .available first (most common format)
    if (typeof obj.available === 'string') {
      return obj.available;
    }
    
    // Try .status as fallback
    if (typeof obj.status === 'string') {
      return obj.status;
    }
  }
  
  return undefined;
}

/**
 * Normalize raw availability status from Chrome AI APIs
 */
export function normalizeAvailability(
  rawStatus: string,
  apiSurface: 'LanguageModel' | 'window.ai.languageModel' | 'window.ai.assistant' | 'none'
): NormalizedStatus {
  // Map raw statuses to normalized ones
  if (rawStatus === 'readily') return 'ready';
  if (rawStatus === 'after-download') return 'downloadable';
  if (rawStatus === 'downloadable') return 'downloadable';
  if (rawStatus === 'no') return 'unavailable';
  if (rawStatus === 'downloading') return 'downloading';
  
  // Handle legacy API responses
  if (rawStatus === 'available') return 'ready';
  if (rawStatus === 'unavailable') return 'unavailable';
  
  // Default to error for unknown statuses
  return 'error';
}

/**
 * Get browser information for diagnostic purposes
 */
export function getBrowserInfo(): NormalizedAvailability['browserInfo'] {
  if (typeof navigator === 'undefined') return undefined;
  
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  
  // Extract Chrome version from user agent
  const chromeMatch = ua.match(/Chrome\/(\d+\.\d+\.\d+\.\d+)/);
  const chromeVersion = chromeMatch ? chromeMatch[1] : undefined;
  
  return {
    userAgent: ua,
    platform,
    chromeVersion,
  };
}

/**
 * Smoke test: try to create a session and run a minimal prompt
 * Used as fallback when availability() fails or returns unexpected values
 */
async function smokeTestChromeAi(
  apiSurface: 'LanguageModel' | 'window.ai.languageModel' | 'window.ai.assistant',
  technicalDetails: string[]
): Promise<boolean> {
  let session: { prompt(input: string): Promise<string>; destroy?(): void } | null = null;
  try {
    technicalDetails.push('Running smoke test: creating session and testing prompt...');
    
    if (apiSurface === 'LanguageModel') {
      session = await globalThis.LanguageModel!.create();
      const response = await session.prompt('Responde solo: OK');
      technicalDetails.push(`Smoke test response: "${response}"`);
      return response.includes('OK');
    }
    
    if (apiSurface === 'window.ai.languageModel') {
      session = await window.ai!.languageModel!.create();
      const response = await session.prompt('Responde solo: OK');
      technicalDetails.push(`Smoke test response: "${response}"`);
      return response.includes('OK');
    }
    
    if (apiSurface === 'window.ai.assistant') {
      const ai = await window.ai!.assistant!();
      session = await ai.create();
      const response = await session.prompt('Responde solo: OK');
      technicalDetails.push(`Smoke test response: "${response}"`);
      return response.includes('OK');
    }
    
    return false;
  } catch (e) {
    technicalDetails.push(`Smoke test failed: ${(e as Error).message}`);
    return false;
  } finally {
    if (session) {
      try { session.destroy?.(); } catch { /* ignore */ }
    }
  }
}

/**
 * Detect Chrome AI API availability and return normalized status
 */
export async function detectChromeAiAvailability(): Promise<NormalizedAvailability> {
  const technicalDetails: string[] = [];
  const detectedAt = new Date().toISOString();
  
  // Detect API surface
  let apiSurface: NormalizedAvailability['apiSurface'] = 'none';
  
  try {
    if (typeof globalThis.LanguageModel !== 'undefined') {
      apiSurface = 'LanguageModel';
      technicalDetails.push('Detected globalThis.LanguageModel (Chrome 138+)');
    }
  } catch (e) {
    technicalDetails.push(`Error checking globalThis.LanguageModel: ${(e as Error).message}`);
  }
  
  if (apiSurface === 'none') {
    try {
      if (typeof window !== 'undefined' && window.ai?.languageModel) {
        apiSurface = 'window.ai.languageModel';
        technicalDetails.push('Detected window.ai.languageModel (Chrome 127-137)');
      }
    } catch (e) {
      technicalDetails.push(`Error checking window.ai.languageModel: ${(e as Error).message}`);
    }
  }
  
  if (apiSurface === 'none') {
    try {
      if (typeof window !== 'undefined' && window.ai?.assistant) {
        apiSurface = 'window.ai.assistant';
        technicalDetails.push('Detected window.ai.assistant (legacy)');
      }
    } catch (e) {
      technicalDetails.push(`Error checking window.ai.assistant: ${(e as Error).message}`);
    }
  }
  
  // If no API surface found, return api_missing
  if (apiSurface === 'none') {
    return {
      status: 'api_missing',
      apiSurface: 'none',
      message: 'API de Chrome AI no detectada en este navegador.',
      technicalDetails: [
        'No se encontró globalThis.LanguageModel, window.ai.languageModel, ni window.ai.assistant.',
        'Chrome AI requiere Chrome 138+ con flags habilitados.',
        'Visita chrome://flags para habilitar la API de Prompt.',
      ],
      browserInfo: getBrowserInfo(),
      detectedAt,
    };
  }
  
  // Check availability for detected API surface
  let rawAvailability: string | undefined;
  let availabilityCallMode: 'clean' = 'clean';
  
  try {
    // Clean call: availability() without options (Chrome AI compatible)
    if (apiSurface === 'LanguageModel') {
      try {
        const availabilityResult = await globalThis.LanguageModel!.availability();
        rawAvailability = extractAvailabilityValue(availabilityResult);
        technicalDetails.push(`LanguageModel.availability() (clean) returned: ${JSON.stringify(availabilityResult)} => extracted: ${rawAvailability}`);
      } catch (e) {
        technicalDetails.push(`LanguageModel.availability() (clean) failed: ${(e as Error).message}`);
      }
    } else if (apiSurface === 'window.ai.languageModel') {
      try {
        const availabilityResult = await window.ai!.languageModel!.availability();
        availabilityWithOptionsRaw = extractAvailabilityValue(availabilityResult);
        rawAvailability = availabilityWithOptionsRaw;
        technicalDetails.push(`window.ai.languageModel.availability() returned: ${JSON.stringify(availabilityResult)} => extracted: ${rawAvailability}`);
      } catch (e) {
        technicalDetails.push(`window.ai.languageModel.availability() failed: ${(e as Error).message}`);
      }
    } else {
      // Legacy assistant API
      const ai = await window.ai!.assistant!();
      const caps = await ai.capabilities();
      rawAvailability = caps.available ? 'readily' : 'no';
      technicalDetails.push(`window.ai.assistant.capabilities() returned available: ${caps.available}`);
    }
    
    // If availability returned undefined/null/empty, try smoke test as fallback
    if (rawAvailability === undefined || rawAvailability === null || rawAvailability === '') {
      technicalDetails.push('Availability returned undefined/null/empty, running smoke test fallback...');
      const smokeTestPassed = await smokeTestChromeAi(apiSurface, technicalDetails);
      
      if (smokeTestPassed) {
        rawAvailability = 'readily';
        technicalDetails.push('Smoke test passed, treating as ready');
      } else {
        rawAvailability = 'no';
        technicalDetails.push('Smoke test failed, treating as unavailable');
      }
    }
    
    const normalizedStatus = normalizeAvailability(rawAvailability, apiSurface);
    
    // Generate user-friendly message based on status
    let message: string;
    switch (normalizedStatus) {
      case 'ready':
        message = 'Gemini Nano listo para usar en este navegador.';
        break;
      case 'downloadable':
        message = 'Gemini Nano requiere una descarga inicial antes de usarse.';
        break;
      case 'downloading':
        message = 'Gemini Nano se está descargando actualmente.';
        break;
      case 'unavailable':
        message = 'Gemini Nano no está disponible en este dispositivo.';
        break;
      default:
        message = 'Estado desconocido de Chrome AI.';
    }
    
    return {
      status: normalizedStatus,
      apiSurface,
      message,
      technicalDetails,
      browserInfo: getBrowserInfo(),
      availabilityRaw: rawAvailability,
      availabilityCallMode,
      detectedAt,
    };
  } catch (error) {
    technicalDetails.push(`Error checking availability: ${(error as Error).message}`);
    
    // If availability check failed entirely, try smoke test as last resort
    technicalDetails.push('Availability check failed, attempting smoke test as last resort...');
    const smokeTestPassed = await smokeTestChromeAi(apiSurface, technicalDetails);
    
    if (smokeTestPassed) {
      return {
        status: 'ready',
        apiSurface,
        message: 'Gemini Nano listo para usar (verificado por prueba de fuego).',
        technicalDetails,
        browserInfo: getBrowserInfo(),
        availabilityRaw: 'smoke_test_passed',
        availabilityCallMode,
        detectedAt,
      };
    }
    
    return {
      status: 'error',
      apiSurface,
      message: `Error al verificar Chrome AI: ${(error as Error).message}`,
      technicalDetails,
      browserInfo: getBrowserInfo(),
      availabilityRaw: rawAvailability,
      availabilityCallMode,
      detectedAt,
    };
  }
}

/**
 * Check if Chrome AI is available and ready to use
 */
export async function isChromeAiReady(): Promise<boolean> {
  const availability = await detectChromeAiAvailability();
  return availability.status === 'ready';
}

/**
 * Check if Chrome AI needs download
 */
export async function isChromeAiDownloadable(): Promise<boolean> {
  const availability = await detectChromeAiAvailability();
  return availability.status === 'downloadable';
}

/**
 * Get human-readable status description
 */
export function getStatusDescription(status: NormalizedStatus): {
  label: string;
  color: 'success' | 'warning' | 'error' | 'info';
  icon: string;
} {
  switch (status) {
    case 'ready':
      return { label: 'Listo', color: 'success', icon: '✓' };
    case 'downloadable':
      return { label: 'Descargable', color: 'warning', icon: '↓' };
    case 'downloading':
      return { label: 'Descargando', color: 'info', icon: '⟳' };
    case 'unavailable':
      return { label: 'No disponible', color: 'error', icon: '✗' };
    case 'api_missing':
      return { label: 'API no detectada', color: 'error', icon: '✗' };
    case 'error':
      return { label: 'Error', color: 'error', icon: '!' };
    default:
      return { label: 'Desconocido', color: 'info', icon: '?' };
  }
}