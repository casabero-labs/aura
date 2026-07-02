// ── Phase 8 L1 — Demo/Prod Boundary Hardening ──
// Centralized detection of demo/evidence mode for visual harnesses.
//
// RULE: visual harnesses, mock states, controlled fixtures, and forced
// evidence runs MUST only be reachable through explicit opt-in flags.
// In normal/product mode (no flag), AURA must not display demo data
// or pretend a controlled run is a production result.
//
// Allowed activation triggers (opt-in, non-CI):
//   - Query param: ?phase7Visual=running | ?phase7Visual=error
//   - Query param: ?demoMode=1  (generic Phase 8 trigger)
//
// All other code paths are considered "normal/product mode".

export type DemoMode = {
  active: boolean;
  source: 'none' | 'query_param_phase7' | 'query_param_demo';
  visual: 'none' | 'running' | 'error';
};

export function detectDemoMode(search: string = (typeof window !== 'undefined' ? window.location.search : '')): DemoMode {
  const params = new URLSearchParams(search);

  const visual = params.get('phase7Visual');
  if (visual === 'running' || visual === 'error') {
    return { active: true, source: 'query_param_phase7', visual };
  }

  const demoParam = params.get('demoMode');
  if (demoParam === '1' || demoParam === 'true') {
    return { active: true, source: 'query_param_demo', visual: 'none' };
  }

  return { active: false, source: 'none', visual: 'none' };
}

export const PROHIBITED_CLAIMS: readonly string[] = [
  'production-ready',
  'corrected real datasets',
  'executes python internally',
  'always available',
  'formal benchmark exists',
  'external independent validation',
];

export const DEMO_MODE_NOTICE = 'DEMO / EVIDENCE MODE — controlled fixture only';

export function isProhibitedClaim(text: string): boolean {
  const lower = text.toLowerCase();
  return PROHIBITED_CLAIMS.some((c) => lower.includes(c.toLowerCase()));
}