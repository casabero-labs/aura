/**
 * Chrome Model Status Service
 * 
 * Centralized service for Chrome AI model status management.
 * Uses detectChromeAiAvailability() as single source of truth.
 * Provides polling, normalization, and UI state management.
 */

import { detectChromeAiAvailability, NormalizedAvailability, NormalizedStatus } from './chromeAvailability';

export type UIStatus = 'idle' | 'api_missing' | 'unavailable' | 'downloadable' | 'downloading' | 'preparing' | 'ready' | 'error';

export interface ChromeModelStatus {
  uiStatus: UIStatus;
  availability: NormalizedAvailability | null;
  downloadProgress: number | undefined;
  downloadLoaded: number | undefined;
  downloadTotal: number | undefined;
  downloadMessage: string;
  isPolling: boolean;
  lastChecked: Date | null;
}

export interface DownloadProgressInfo {
  percent: number;
  loaded: number;
  total: number;
}

type StatusListener = (status: ChromeModelStatus) => void;

let pollingInterval: ReturnType<typeof setInterval> | null = null;
let currentStatus: ChromeModelStatus = {
  uiStatus: 'idle',
  availability: null,
  downloadProgress: undefined,
  downloadLoaded: undefined,
  downloadTotal: undefined,
  downloadMessage: '',
  isPolling: false,
  lastChecked: null,
};
let listeners: Set<StatusListener> = new Set();

function notifyListeners() {
  listeners.forEach(listener => listener({ ...currentStatus }));
}

function mapNormalizedToUI(normalized: NormalizedStatus): UIStatus {
  switch (normalized) {
    case 'ready': return 'ready';
    case 'downloadable': return 'downloadable';
    case 'downloading': return 'downloading';
    case 'unavailable': return 'unavailable';
    case 'api_missing': return 'api_missing';
    case 'error': return 'error';
    default: return 'idle';
  }
}

export async function getChromeModelStatus(): Promise<ChromeModelStatus> {
  return { ...currentStatus };
}

export async function checkChromeModelStatus(): Promise<ChromeModelStatus> {
  try {
    const availability = await detectChromeAiAvailability();
    
    currentStatus = {
      ...currentStatus,
      availability,
      uiStatus: mapNormalizedToUI(availability.status),
      lastChecked: new Date(),
    };
    
    notifyListeners();
    return { ...currentStatus };
  } catch (error) {
    currentStatus = {
      ...currentStatus,
      uiStatus: 'error',
      availability: null,
      lastChecked: new Date(),
    };
    notifyListeners();
    return { ...currentStatus };
  }
}

export function startChromeModelPolling(onStatusChange?: StatusListener): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }
  
  if (onStatusChange) {
    listeners.add(onStatusChange);
  }
  
  checkChromeModelStatus();
  
  pollingInterval = setInterval(async () => {
    const prevStatus = currentStatus.uiStatus;
    await checkChromeModelStatus();
    
    if (prevStatus === 'downloading' && currentStatus.uiStatus === 'ready') {
      stopChromeModelPolling();
    }
  }, 5000);
  
  currentStatus.isPolling = true;
  notifyListeners();
}

export function stopChromeModelPolling(): void {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
  
  currentStatus.isPolling = false;
  notifyListeners();
}

export function subscribeToStatusChanges(listener: StatusListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function updateDownloadProgress(info: DownloadProgressInfo): void {
  currentStatus = {
    ...currentStatus,
    downloadProgress: info.percent,
    downloadLoaded: info.loaded,
    downloadTotal: info.total,
    downloadMessage: info.total > 0 
      ? `${info.percent}% — ${formatMB(info.loaded)} / ${formatMB(info.total)}`
      : `Descargando... ${info.percent}%`,
    uiStatus: 'downloading',
  };
  notifyListeners();
}

export function setPreparingState(message: string = 'Preparando Gemini Nano...'): void {
  currentStatus = {
    ...currentStatus,
    uiStatus: 'preparing',
    downloadMessage: message,
    downloadProgress: undefined,
  };
  notifyListeners();
}

export function clearDownloadProgress(): void {
  currentStatus = {
    ...currentStatus,
    downloadProgress: undefined,
    downloadLoaded: undefined,
    downloadTotal: undefined,
    downloadMessage: '',
  };
  notifyListeners();
}

export function normalizeChromeModelState(availability: NormalizedAvailability): UIStatus {
  return mapNormalizedToUI(availability.status);
}

export function getStatusLabel(status: UIStatus): string {
  switch (status) {
    case 'idle': return 'Sin verificar';
    case 'api_missing': return 'API no detectada';
    case 'unavailable': return 'No disponible';
    case 'downloadable': return 'Disponible para descarga';
    case 'downloading': return 'Descargando';
    case 'preparing': return 'Preparando';
    case 'ready': return 'Listo';
    case 'error': return 'Error';
    default: return 'Desconocido';
  }
}

export function getStatusColor(status: UIStatus): 'success' | 'warning' | 'error' | 'info' {
  switch (status) {
    case 'ready': return 'success';
    case 'downloadable': return 'warning';
    case 'downloading': return 'info';
    case 'preparing': return 'info';
    case 'unavailable': return 'error';
    case 'api_missing': return 'error';
    case 'error': return 'error';
    default: return 'info';
  }
}

export function getStatusIcon(status: UIStatus): string {
  switch (status) {
    case 'idle': return '?';
    case 'api_missing': return '✗';
    case 'unavailable': return '✗';
    case 'downloadable': return '↓';
    case 'downloading': return '⟳';
    case 'preparing': return '⚙';
    case 'ready': return '✓';
    case 'error': return '!';
    default: return '?';
  }
}

function formatMB(bytes: number): string {
  if (bytes === 0) return '0 MB';
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export async function prepareChromeModel(): Promise<{ success: boolean; error?: string }> {
  setPreparingState('Iniciando descarga de Gemini Nano...');
  
  try {
    const availability = await detectChromeAiAvailability();
    
    if (availability.status === 'ready') {
      currentStatus = {
        ...currentStatus,
        uiStatus: 'ready',
        availability,
        downloadMessage: 'Gemini Nano ya está listo.',
      };
      notifyListeners();
      return { success: true };
    }
    
    if (availability.status !== 'downloadable' && availability.status !== 'downloading') {
      return { success: false, error: availability.message };
    }
    
    startChromeModelPolling();
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export function resetChromeModelStatus(): void {
  stopChromeModelPolling();
  listeners.clear();
  currentStatus = {
    uiStatus: 'idle',
    availability: null,
    downloadProgress: undefined,
    downloadLoaded: undefined,
    downloadTotal: undefined,
    downloadMessage: '',
    isPolling: false,
    lastChecked: null,
  };
  notifyListeners();
}
