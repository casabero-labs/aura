// ── Phase 8 L4 — Provider Validation Opt-in Helper ──
// Detects whether the current session is running in provider-validation opt-in mode.
//
// RULES:
//   - Real provider validation is opt-in ONLY.
//   - Standard E2E must NOT depend on real providers.
//   - CI must NOT run provider real validation.
//   - AURA must NOT assert production-ready based on provider availability.
//
// Activation (opt-in — requires explicit user action):
//   - Env var:  AURA_PROVIDER_VALIDATION=chrome|ollama|gemini|all
//   - Query param: ?providerValidation=chrome|ollama|gemini|all
//
// Deactivation (default — standard mode):
//   - No env var set
//   - No query param set
//   - CI builds and tests run without real provider calls

export type ProviderType = 'chrome' | 'ollama' | 'gemini' | 'webllm';

export interface ProviderOptInStatus {
  active: boolean;
  providers: ProviderType[];
  source: 'none' | 'env' | 'query_param';
  requestedProviders: ProviderType[];
}

const ALL_PROVIDERS: ProviderType[] = ['chrome', 'ollama', 'gemini', 'webllm'];

function parseProviderList(raw: string): ProviderType[] {
  const rawLower = raw.toLowerCase().trim();
  if (rawLower === 'all') return ALL_PROVIDERS;
  const requested = rawLower.split(',').map(s => s.trim()).filter(Boolean);
  return requested.filter(p => ALL_PROVIDERS.includes(p as ProviderType)) as ProviderType[];
}

export function detectProviderOptIn(
  envProviders: string | undefined = process.env.AURA_PROVIDER_VALIDATION,
  search: string = (typeof window !== 'undefined' ? window.location.search : '')
): ProviderOptInStatus {
  if (envProviders && envProviders.trim().length > 0) {
    const providers = parseProviderList(envProviders);
    if (providers.length > 0) {
      return { active: true, providers, source: 'env', requestedProviders: providers };
    }
  }

  const params = new URLSearchParams(search);
  const qp = params.get('providerValidation');
  if (qp && qp.trim().length > 0) {
    const providers = parseProviderList(qp);
    if (providers.length > 0) {
      return { active: true, providers, source: 'query_param', requestedProviders: providers };
    }
  }

  return { active: false, providers: [], source: 'none', requestedProviders: [] };
}

export const PROVIDER_VALIDATION_CLAIMS_ALLOWED: readonly string[] = [
  'Chrome AI availability was validated in controlled opt-in mode',
  'Ollama local availability was validated in controlled opt-in mode',
  'Gemini Cloud API key presence was checked',
  'Provider availability does not imply production-ready',
  'Provider validation was performed manually in opt-in mode with explicit user activation',
];

export const PROVIDER_VALIDATION_CLAIMS_PROHIBITED: readonly string[] = [
  'production-ready',
  'always available',
  'works on all environments',
  'benchmark formal',
  'corrected datasets',
];

export function isProviderValidationClaimProhibited(text: string): boolean {
  const lower = text.toLowerCase();
  return PROVIDER_VALIDATION_CLAIMS_PROHIBITED.some(c => lower.includes(c.toLowerCase()));
}

export const PROVIDER_NOTICE = 'PROVIDER VALIDATION MODE — real provider called, not production behavior';

export const PROVIDER_STATES = [
  'not_configured',
  'unavailable',
  'downloadable',
  'available',
  'attempted_failed',
  'preliminary_valid',
] as const;

export type ProviderState = typeof PROVIDER_STATES[number];

export interface ProviderValidationResult {
  provider: ProviderType;
  state: ProviderState;
  checkedAt: string;
  details?: string;
  error?: string;
}
