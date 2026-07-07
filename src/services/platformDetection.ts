/**
 * Platform Detection for Ollama Local Bridge
 *
 * Detects OS and browser to provide platform-specific instructions
 * for configuring OLLAMA_ORIGINS.
 */

export type DesktopOS = 'windows' | 'macos' | 'linux' | 'unknown';

export type BrowserFamily = 'chrome' | 'edge' | 'firefox' | 'safari' | 'other';

export interface PlatformInfo {
  os: DesktopOS;
  browser: BrowserFamily;
  isSecureContext: boolean;
  detectedAt: string;
  userAgent?: string;
  platformRaw?: string;
}

export function detectOS(): DesktopOS {
  try {
    const uaData = (navigator as any).userAgentData;
    if (uaData?.platform) {
      const platform = String(uaData.platform).toLowerCase();
      if (platform.includes('win')) return 'windows';
      if (platform.includes('mac')) return 'macos';
      if (platform.includes('linux')) return 'linux';
    }
  } catch { /* fall through */ }

  try {
    const platform = (navigator.platform || '').toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
  } catch { /* fall through */ }

  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    if (ua.includes('win')) return 'windows';
    if (ua.includes('mac')) return 'macos';
    if (ua.includes('linux') && !ua.includes('android')) return 'linux';
  } catch { /* fall through */ }

  return 'unknown';
}

export function detectBrowser(): BrowserFamily {
  try {
    const ua = (navigator.userAgent || '').toLowerCase();
    const vendor = (navigator.vendor || '').toLowerCase();

    if (ua.includes('edg/')) return 'edge';
    if (ua.includes('chrome') && !ua.includes('edg/')) {
      if (vendor.includes('google')) return 'chrome';
      return 'chrome';
    }
    if (ua.includes('firefox')) return 'firefox';
    if (ua.includes('safari') && !ua.includes('chrome') && !ua.includes('edg/')) return 'safari';
  } catch { /* fall through */ }

  return 'other';
}

export function isSecureContext(): boolean {
  try {
    return window.isSecureContext === true;
  } catch {
    return false;
  }
}

export function detectPlatform(): PlatformInfo {
  return {
    os: detectOS(),
    browser: detectBrowser(),
    isSecureContext: isSecureContext(),
    detectedAt: new Date().toISOString(),
    userAgent: (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
    platformRaw: (typeof navigator !== 'undefined' ? (navigator as any).userAgentData?.platform || navigator.platform : undefined),
  };
}

const OS_LABELS: Record<DesktopOS, string> = {
  windows: 'Windows',
  macos: 'macOS',
  linux: 'Linux',
  unknown: 'Desconocido',
};

export function getOSLabel(os: DesktopOS): string {
  return OS_LABELS[os] || 'Desconocido';
}
