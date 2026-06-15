/**
 * Model Manager — Check download status, delete cached models.
 * WebLLM stores models in IndexedDB (model weights) and Cache API (compiled artifacts).
 */

import { LocalModelStatus } from '../types';
import { LOCAL_MODELS } from './modelRegistry';

export interface DownloadedModelInfo {
  modelId: string;
  name: string;
  sizeGB: number;
  family: string;
  downloadedAt?: string;
}

/**
 * Check if a specific model is already downloaded/cached.
 * WebLLM uses IndexedDB with key "webllm-model-cache" and Cache API.
 */
export const checkModelDownloaded = async (modelId: string): Promise<boolean> => {
  if (typeof indexedDB === 'undefined') return false;

  try {
    const db = await openModelDB();
    const tx = db.transaction('models', 'readonly');
    const store = tx.objectStore('models');
    const request = store.getKey(modelId);
    const indexedDbHit = await new Promise<boolean>((resolve) => {
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => resolve(false);
    });

    if (indexedDbHit) return true;
  } catch {
    // WebLLM cache internals vary by version; fall back to Cache API inspection below.
  }

  try {
    if (typeof caches === 'undefined') return false;
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      const cache = await caches.open(cacheName);
      const keys = await cache.keys();
      if (keys.some((request) => request.url.includes(modelId))) return true;
    }
  } catch {
    return false;
  }

  return false;
};

/**
 * Robust local model status check.
 * Only preloadModel() completion marks ready with high confidence.
 * Cache API alone can only mark partial, not ready.
 * localStorage state is not treated as authoritative.
 */
export const getLocalModelStatus = async (modelId: string): Promise<LocalModelStatus> => {
  const preloadKey = `aura_preload_verified_${modelId}`;
  const preloadVerified = localStorage.getItem(preloadKey) === 'true';

  if (preloadVerified) {
    const dbOk = await hasIndexedDBModel(modelId);
    if (dbOk) {
      return {
        status: 'ready',
        confidence: 'high',
        source: 'preload_verified',
        message: 'Modelo verificado y listo para usar.',
      };
    }
    localStorage.removeItem(preloadKey);
  }

  try {
    const indexedDbHit = typeof indexedDB !== 'undefined' && await hasIndexedDBModel(modelId);
    if (indexedDbHit) {
      return {
        status: 'partial',
        confidence: 'medium',
        source: 'indexeddb',
        message: 'Detectado en caché pero no verificado. Haz clic en Verificar o Descargar.',
      };
    }
  } catch {
    // Fall through
  }

  try {
    const cacheHit = typeof caches !== 'undefined' && await hasCacheModel(modelId);
    if (cacheHit) {
      return {
        status: 'partial',
        confidence: 'low',
        source: 'cache_api',
        message: 'Restos detectados en Cache API. Estado no fiable. Descarga nuevamente.',
      };
    }
  } catch {
    // Fall through
  }

  return {
    status: 'not_downloaded',
    confidence: 'high',
    source: 'unknown',
    message: 'Modelo no descargado.',
  };
};

const hasIndexedDBModel = async (modelId: string): Promise<boolean> => {
  const db = await openModelDB();
  const tx = db.transaction('models', 'readonly');
  const store = tx.objectStore('models');
  return new Promise((resolve) => {
    const request = store.getKey(modelId);
    request.onsuccess = () => resolve(request.result !== undefined);
    request.onerror = () => resolve(false);
  });
};

const hasCacheModel = async (modelId: string): Promise<boolean> => {
  const cacheNames = await caches.keys();
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.some((request) => request.url.includes(modelId))) return true;
  }
  return false;
};

export const markPreloadVerified = (modelId: string) => {
  localStorage.setItem(`aura_preload_verified_${modelId}`, 'true');
};

export const clearPreloadVerification = (modelId: string) => {
  localStorage.removeItem(`aura_preload_verified_${modelId}`);
};

/**
 * Get all downloaded models.
 */
export const getDownloadedModels = async (): Promise<DownloadedModelInfo[]> => {
  const results: DownloadedModelInfo[] = [];

  for (const model of LOCAL_MODELS) {
    const downloaded = await checkModelDownloaded(model.id);
    if (downloaded) {
      results.push({
        modelId: model.id,
        name: model.name,
        sizeGB: model.sizeGB,
        family: model.family,
      });
    }
  }

  return results;
};

/**
 * Delete a downloaded model from both IndexedDB and Cache API.
 */
export const deleteDownloadedModel = async (modelId: string): Promise<boolean> => {
  try {
    // Delete from IndexedDB
    const db = await openModelDB();
    const tx = db.transaction('models', 'readwrite');
    const store = tx.objectStore('models');
    store.delete(modelId);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Delete from Cache API
    const cacheNames = await caches.keys();
    for (const cacheName of cacheNames) {
      if (cacheName.includes(modelId) || cacheName.includes('webllm')) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        for (const req of keys) {
          if (req.url.includes(modelId)) {
            await cache.delete(req);
          }
        }
      }
    }

    return true;
  } catch {
    return false;
  }
};

/**
 * Open the WebLLM IndexedDB database.
 */
const openModelDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('webllm-model-cache', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('models')) {
        db.createObjectStore('models');
      }
    };
  });
};

/**
 * Estimate total storage used by downloaded models.
 */
export const getTotalDownloadedSize = async (): Promise<number> => {
  const downloaded = await getDownloadedModels();
  return downloaded.reduce((sum, m) => sum + m.sizeGB, 0);
};
