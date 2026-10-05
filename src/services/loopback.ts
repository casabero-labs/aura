/**
 * Loopback detection shared by every component that talks to a local model
 * server (Ollama). AURA promises that data does not leave the device without
 * a decision; a local provider is therefore only "local" when its endpoint
 * resolves to this machine's loopback interface.
 *
 * Accepted hosts: `localhost`, `*.localhost` (RFC 6761), `127.0.0.0/8` and
 * `::1`. Private LAN addresses (192.168.x.x, 10.x.x.x, *.local) are NOT
 * loopback: they reach another device.
 */

// Captured at module load so a later reassignment of the global `URL`
// (polyfills, test stubs) cannot weaken the check.
const URLParser: typeof URL = globalThis.URL;

const IPV4_LOOPBACK = /^127(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;

export function isLoopbackHost(rawHost: string): boolean {
  const host = rawHost.trim().toLowerCase();
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost')) return true;
  if (host === '::1' || host === '[::1]') return true;
  return IPV4_LOOPBACK.test(host);
}

/**
 * True when `url` is an http(s) URL whose host is loopback. The WHATWG URL
 * parser normalises alternative IPv4 spellings (e.g. `2130706433`) before the
 * check, so they cannot smuggle a non-loopback address.
 */
export function isLocalLoopback(url: string): boolean {
  try {
    const parsed = new URLParser(url.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return isLoopbackHost(parsed.hostname);
  } catch {
    return false;
  }
}

/** Human-readable host for error messages; never throws. */
export function describeEndpointHost(url: string): string {
  try {
    return new URLParser(url.trim()).host || url.trim();
  } catch {
    return url.trim() || '(vacío)';
  }
}

/** Thrown before any request leaves AURA towards a non-loopback model server. */
export class NonLocalEndpointError extends Error {
  readonly code = 'OLLAMA_ENDPOINT_NOT_LOCAL';
  readonly endpoint: string;

  constructor(endpoint: string) {
    super(
      `AURA no envía datos a «${describeEndpointHost(endpoint)}»: no es una dirección de este equipo. ` +
      'Ollama debe estar en localhost, 127.0.0.1 o ::1. Corrige la URL en Configuración › Proveedores.',
    );
    this.name = 'NonLocalEndpointError';
    this.endpoint = endpoint;
  }
}

/** Throws `NonLocalEndpointError` unless `url` is loopback. */
export function assertLocalLoopback(url: string): void {
  if (!isLocalLoopback(url)) throw new NonLocalEndpointError(url);
}
