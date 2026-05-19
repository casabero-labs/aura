/**
 * Model Manager — Check download status, delete cached models.
 * WebLLM stores models in IndexedDB (model weights) and Cache API (compiled artifacts).
 */

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
  try {
    const db = await openModelDB();
    const tx = db.transaction('models', 'readonly');
    const store = tx.objectStore('models');
    const request = store.getKey(modelId);
    return new Promise((resolve) => {
      request.onsuccess = () => resolve(request.result !== undefined);
      request.onerror = () => resolve(false);
    });
  } catch {
    return false;
  }
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
