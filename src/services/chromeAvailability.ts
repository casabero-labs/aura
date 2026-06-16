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
  if (rawStatus === 'no') return 'unavailable';
  
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
 * Detect Chrome AI API availability and return normalized status
 */
export async function detectChromeAiAvailability(): Promise<NormalizedAvailability> {
  const technicalDetails: string[] = [];
  
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
  
  // If no API surface found, return unavailable
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
    };
  }
  
  // Check availability for detected API surface
  try {
    let rawAvailability: string;
    
    if (apiSurface === 'LanguageModel') {
      const availability = await globalThis.LanguageModel!.availability();
      rawAvailability = availability.available;
      technicalDetails.push(`LanguageModel.availability() returned: ${rawAvailability}`);
    } else if (apiSurface === 'window.ai.languageModel') {
      const availability = await window.ai!.languageModel!.availability();
      rawAvailability = availability.available;
      technicalDetails.push(`window.ai.languageModel.availability() returned: ${rawAvailability}`);
    } else {
      // Legacy assistant API
      const ai = await window.ai!.assistant!();
      const caps = await ai.capabilities();
      rawAvailability = caps.available ? 'readily' : 'no';
      technicalDetails.push(`window.ai.assistant.capabilities() returned available: ${caps.available}`);
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
    };
  } catch (error) {
    technicalDetails.push(`Error checking availability: ${(error as Error).message}`);
    return {
      status: 'error',
      apiSurface,
      message: `Error al verificar Chrome AI: ${(error as Error).message}`,
      technicalDetails,
      browserInfo: getBrowserInfo(),
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