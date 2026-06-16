/**
 * NetworkGuard - Temporary network interception during Chrome AI diagnosis
 * 
 * Intercepts fetch, XMLHttpRequest, sendBeacon, and WebSocket during
 * Chrome AI diagnosis to monitor for external requests.
 */

export interface NetworkRequest {
  type: 'fetch' | 'xhr' | 'beacon' | 'websocket';
  url: string;
  method?: string;
  timestamp: number;
  initiator: string;
}

export interface NetworkGuardResult {
  requests: NetworkRequest[];
  externalRequests: NetworkRequest[];
  auraRequests: NetworkRequest[];
  totalRequests: number;
}

/**
 * NetworkGuard class for monitoring network requests during diagnosis
 */
export class NetworkGuard {
  private originalFetch: typeof fetch | null = null;
  private originalXHROpen: typeof XMLHttpRequest.prototype.open | null = null;
  private originalSendBeacon: typeof navigator.sendBeacon | null = null;
  private originalWebSocket: typeof WebSocket | null = null;
  
  private requests: NetworkRequest[] = [];
  private isActive = false;
  private auraDomain: string;
  
  constructor(auraDomain: string = window.location.origin) {
    this.auraDomain = auraDomain;
  }
  
  /**
   * Start monitoring network requests
   */
  start(): void {
    if (this.isActive) return;
    
    this.requests = [];
    this.isActive = true;
    
    // Store originals
    this.originalFetch = window.fetch;
    this.originalXHROpen = XMLHttpRequest.prototype.open;
    this.originalSendBeacon = navigator.sendBeacon;
    this.originalWebSocket = window.WebSocket;
    
    // Override fetch
    window.fetch = this.createFetchInterceptor();
    
    // Override XMLHttpRequest
    XMLHttpRequest.prototype.open = this.createXHRInterceptor();
    
    // Override sendBeacon
    navigator.sendBeacon = this.createBeaconInterceptor();
    
    // Override WebSocket
    window.WebSocket = this.createWebSocketInterceptor() as any;
  }
  
  /**
   * Stop monitoring and restore original functions
   */
  stop(): NetworkGuardResult {
    if (!this.isActive) {
      return this.getResult();
    }
    
    // Restore originals
    if (this.originalFetch) {
      window.fetch = this.originalFetch;
    }
    if (this.originalXHROpen) {
      XMLHttpRequest.prototype.open = this.originalXHROpen;
    }
    if (this.originalSendBeacon) {
      navigator.sendBeacon = this.originalSendBeacon;
    }
    if (this.originalWebSocket) {
      window.WebSocket = this.originalWebSocket;
    }
    
    this.isActive = false;
    return this.getResult();
  }
  
  /**
   * Get current monitoring results without stopping
   */
  getResult(): NetworkGuardResult {
    const externalRequests = this.requests.filter(r => !this.isAuraRequest(r.url));
    const auraRequests = this.requests.filter(r => this.isAuraRequest(r.url));
    
    return {
      requests: [...this.requests],
      externalRequests,
      auraRequests,
      totalRequests: this.requests.length,
    };
  }
  
  /**
   * Check if monitoring is active
   */
  getIsRunning(): boolean {
    return this.isActive;
  }
  
  private isAuraRequest(url: string): boolean {
    try {
      const requestUrl = new URL(url, window.location.origin);
      return requestUrl.origin === this.auraDomain;
    } catch {
      // If URL parsing fails, assume it's external
      return false;
    }
  }
  
  private createFetchInterceptor(): typeof fetch {
    const self = this;
    return async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const url = typeof input === 'string' ? input : 
                 input instanceof URL ? input.href : 
                 input.url;
      
      const method = init?.method || 'GET';
      
      self.requests.push({
        type: 'fetch',
        url,
        method,
        timestamp: Date.now(),
        initiator: 'fetch',
      });
      
      // Call original fetch
      return self.originalFetch!.call(window, input, init);
    };
  }
  
  private createXHRInterceptor(): typeof XMLHttpRequest.prototype.open {
    const self = this;
    return function(method: string, url: string | URL, async?: boolean, username?: string | null, password?: string | null) {
      const urlString = url instanceof URL ? url.href : url;
      
      self.requests.push({
        type: 'xhr',
        url: urlString,
        method,
        timestamp: Date.now(),
        initiator: 'XMLHttpRequest',
      });
      
      // Call original open
      return self.originalXHROpen!.call(this, method, url, async ?? true, username, password);
    };
  }
  
  private createBeaconInterceptor(): typeof navigator.sendBeacon {
    const self = this;
    return function(url: string | URL, data?: BodyInit | null): boolean {
      const urlString = url instanceof URL ? url.href : url;
      
      self.requests.push({
        type: 'beacon',
        url: urlString,
        timestamp: Date.now(),
        initiator: 'sendBeacon',
      });
      
      // Call original sendBeacon
      return self.originalSendBeacon!.call(navigator, url, data);
    };
  }
  
  private createWebSocketInterceptor(): typeof WebSocket {
    const self = this;
    const OriginalWebSocket = self.originalWebSocket!;
    
    return class extends OriginalWebSocket {
      constructor(url: string | URL, protocols?: string | string[]) {
        const urlString = url instanceof URL ? url.href : url;
        
        self.requests.push({
          type: 'websocket',
          url: urlString,
          timestamp: Date.now(),
          initiator: 'WebSocket',
        });
        
        super(url, protocols);
      }
    };
  }
}

/**
 * Global network guard instance
 */
let globalGuard: NetworkGuard | null = null;

/**
 * Start monitoring network requests globally
 */
export function startNetworkMonitoring(auraDomain?: string): NetworkGuard {
  if (globalGuard) {
    globalGuard.stop();
  }
  
  globalGuard = new NetworkGuard(auraDomain);
  globalGuard.start();
  return globalGuard;
}

/**
 * Stop monitoring and get results
 */
export function stopNetworkMonitoring(): NetworkGuardResult | null {
  if (!globalGuard) {
    return null;
  }
  
  const result = globalGuard.stop();
  globalGuard = null;
  return result;
}

/**
 * Get current monitoring status
 */
export function getNetworkMonitoringStatus(): boolean {
  return globalGuard?.getIsRunning() || false;
}

/**
 * Get current results without stopping
 */
export function getCurrentNetworkResults(): NetworkGuardResult | null {
  return globalGuard?.getResult() || null;
}