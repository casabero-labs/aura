/**
 * Normalized error types for AI providers.
 * Converts raw browser/library errors into human-readable messages with actionable steps.
 */

import { AIConfig } from '../../types';

export interface NormalizedProviderError {
  title: string;
  message: string;
  cause: string;
  recommendedActions: string[];
  technicalMessage: string;
  evidenceStatus: 'attempted_failed';
  category: 'cache_network' | 'webgpu_unsupported' | 'model_download' | 'quota_storage' | 'api_key' | 'chrome_api_missing' | 'chrome_model_download_required' | 'chrome_model_download_failed' | 'chrome_incompatible' | 'chrome_user_activation_required' | 'generic';
}

/**
 * Normalize raw errors from AI providers into structured, user-friendly error objects.
 * @param error - The raw error thrown by the provider
 * @param aiConfig - Current AI configuration for context
 * @returns NormalizedProviderError with title, message, cause, recommended actions
 */
export function normalizeAiProviderError(
  error: unknown,
  aiConfig: AIConfig
): NormalizedProviderError {
  // Preservar errores ya normalizados (ej: de WebLLMProvider)
  if (typeof error === 'object' && error !== null && 'normalized' in error) {
    return (error as any).normalized as NormalizedProviderError;
  }

  const rawMessage = error instanceof Error ? error.message : String(error);
  const rawStack = error instanceof Error ? error.stack : '';
  const technicalMessage = rawStack ? `${rawMessage}\n${rawStack}` : rawMessage;

  // Cache/Network error (most common WebLLM issue)
  if (rawMessage.includes('Cache.add()') && rawMessage.includes('network error')) {
    return {
      title: 'Error de red al cachear modelo',
      message: 'No se pudo guardar el modelo en la caché del navegador. Esto suele ocurrir por conexión inestable o restricciones de almacenamiento.',
      cause: 'Cache.add() encountered a network error',
      recommendedActions: [
        'Verifica tu conexión a internet',
        'Libera espacio en disco si el dispositivo está lleno',
        'Elimina el modelo cacheado y vuelve a intentar la descarga',
        'Prueba con otro navegador compatible (Chrome/Edge 113+)',
      ],
      technicalMessage,
      evidenceStatus: 'attempted_failed',
      category: 'cache_network',
    };
  }

  // WebGPU not supported
  if (
    rawMessage.includes('WebGPU') ||
    rawMessage.includes('webgpu') ||
    rawMessage.includes('navigator.gpu') ||
    rawMessage.includes('GPU adapter')
  ) {
    return {
      title: 'WebGPU no disponible',
      message: 'Tu navegador o dispositivo no soporta WebGPU, que es necesario para ejecutar modelos locales.',
      cause: 'WebGPU no está habilitado o no es compatible con este dispositivo',
      recommendedActions: [
        'Usa Chrome 113+ o Edge 113+ con WebGPU habilitado',
        'Activa WebGPU en chrome://flags/#enable-unsafe-webgpu',
        'Cambia a un proveedor cloud en Configuración',
      ],
      technicalMessage,
      evidenceStatus: 'attempted_failed',
      category: 'webgpu_unsupported',
    };
  }

  // Model download/fetch error
  if (
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('fetch') ||
    rawMessage.includes('download') ||
    rawMessage.includes('model') && rawMessage.includes('load')
  ) {
    return {
      title: 'Error al descargar modelo',
      message: 'No se pudo descargar el modelo local desde el servidor. Puede ser un problema de red o de compatibilidad.',
      cause: rawMessage,
      recommendedActions: [
        'Verifica tu conexión a internet',
        'Intenta con otro modelo más pequeño',
        'Elimina el modelo cacheado y vuelve a intentar',
        'Cambia a un proveedor cloud en Configuración',
      ],
      technicalMessage,
      evidenceStatus: 'attempted_failed',
      category: 'model_download',
    };
  }

  // Quota/Storage errors
  if (
    rawMessage.includes('QuotaExceeded') ||
    rawMessage.includes('quota') ||
    rawMessage.includes('storage') ||
    rawMessage.includes('disk space') ||
    rawMessage.includes('FULL')
  ) {
    return {
      title: 'Almacenamiento insuficiente',
      message: 'No hay suficiente espacio en disco para almacenar el modelo. Los modelos locales requieren varios gigabytes.',
      cause: 'El navegador no pudo almacenar el modelo por falta de espacio',
      recommendedActions: [
        'Libera espacio en disco',
        'Elimina modelos descargados que no estés usando',
        'Cambia a un proveedor cloud que no requiere almacenamiento local',
      ],
      technicalMessage,
      evidenceStatus: 'attempted_failed',
      category: 'quota_storage',
    };
  }

  // API key errors (for cloud providers)
  if (
    rawMessage.includes('API key') ||
    rawMessage.includes('api_key') ||
    rawMessage.includes('401') ||
    rawMessage.includes('403') ||
    rawMessage.includes('Unauthorized') ||
    rawMessage.includes('authentication')
  ) {
    return {
      title: 'Error de autenticación',
      message: 'La clave de API no es válida o no tiene permisos para acceder al modelo.',
      cause: rawMessage,
      recommendedActions: [
        'Verifica que la API key sea correcta',
        'Asegúrate de que la key tenga permisos para el modelo seleccionado',
        'Regenera la API key en el panel del proveedor',
      ],
      technicalMessage,
      evidenceStatus: 'attempted_failed',
      category: 'api_key',
    };
  }

  // Chrome AI specific errors
  if (
    rawMessage.includes('Chrome AI') ||
    rawMessage.includes('Gemini Nano') ||
    rawMessage.includes('chrome://flags') ||
    rawMessage.includes('Prompt API') ||
    rawMessage.includes('user activation') ||
    aiConfig.providerType === 'chrome'
  ) {
    const lower = rawMessage.toLowerCase();

    // User activation required
    if (lower.includes('activation') || lower.includes('user')) {
      return {
        title: 'Chrome AI requiere tu acción',
        message: 'Chrome necesita que actives Gemini Nano manualmente antes de usarlo.',
        cause: 'Chrome Built-in AI requiere user activation para descargar o crear sesión.',
        recommendedActions: [
          'Pulsa "Preparar Gemini Nano" para iniciar la activación.',
          'Si no funciona, abre chrome://flags y busca "Prompt API".',
          'Como alternativa, usa Ollama o Cloud.',
        ],
        technicalMessage,
        evidenceStatus: 'attempted_failed',
        category: 'chrome_user_activation_required',
      };
    }

    // Model download required (but not failed)
    if (lower.includes('descarg') || lower.includes('download') || lower.includes('after-download')) {
      if (lower.includes('fail') || lower.includes('error') || lower.includes('no se pudo')) {
        return {
          title: 'Error al descargar Gemini Nano',
          message: 'La descarga de Gemini Nano falló. Puede ser por espacio insuficiente, red inestable o permisos.',
          cause: rawMessage,
          recommendedActions: [
            'Libera espacio en disco (se requieren ~22GB libres).',
            'Verifica tu conexión a internet.',
            'Revisa chrome://on-device-internals para ver el estado.',
            'Usa Ollama o Cloud como alternativa.',
          ],
          technicalMessage,
          evidenceStatus: 'attempted_failed',
          category: 'chrome_model_download_failed',
        };
      }

      return {
        title: 'Gemini Nano requiere descarga',
        message: 'Gemini Nano necesita descargarse una vez en Chrome antes de usarse.',
        cause: 'El modelo on-device no está descargado.',
        recommendedActions: [
          'Pulsa "Preparar Gemini Nano" para iniciar la descarga.',
          'No cierres esta pestaña durante la descarga.',
          'Asegúrate de tener ~22GB libres y conexión estable.',
        ],
        technicalMessage,
        evidenceStatus: 'attempted_failed',
        category: 'chrome_model_download_required',
      };
    }

    // API missing
    if (lower.includes('no detectada') || lower.includes('no presente') || lower.includes('no está habilitado') || lower.includes('no disponible')) {
      return {
        title: 'Chrome AI no habilitado',
        message: 'La API de Chrome AI no está disponible en este navegador.',
        cause: rawMessage,
        recommendedActions: [
          'Verifica que uses Chrome 138 o superior.',
          'Abre chrome://flags y busca "Prompt API" o "Built-in AI".',
          'Activa las opciones disponibles y reinicia Chrome.',
          'Como alternativa, usa Ollama o Cloud.',
        ],
        technicalMessage,
        evidenceStatus: 'attempted_failed',
        category: 'chrome_api_missing',
      };
    }

    // Incompatible device
    if (lower.includes('dispositivo') || lower.includes('compatible') || lower.includes('no está soportado')) {
      return {
        title: 'Dispositivo incompatible con Gemini Nano',
        message: 'Tu dispositivo no cumple los requisitos para Gemini Nano (macOS 13+, GPU >4GB VRAM o CPU 16GB RAM 4 cores, 22GB libres).',
        cause: rawMessage,
        recommendedActions: [
          'Usa Ollama local como alternativa en este dispositivo.',
          'Usa Cloud como alternativa.',
        ],
        technicalMessage,
        evidenceStatus: 'attempted_failed',
        category: 'chrome_incompatible',
      };
    }
  }

  // Generic fallback
  return {
    title: 'Error del proveedor de IA',
    message: 'Ocurrió un error inesperado al comunicarse con el proveedor de IA.',
    cause: rawMessage,
    recommendedActions: [
      'Intenta nuevamente',
      'Cambia de proveedor en Configuración',
      'Verifica la consola del navegador para más detalles técnicos',
    ],
    technicalMessage,
    evidenceStatus: 'attempted_failed',
    category: 'generic',
  };
}