// ── Phase 8 L5 — Benchmark Evidence Classification ──
// Centralized classification of AURA runs into evidence tiers.
//
// RULES:
//   - No run is formal_valid unless it meets ALL criteria:
//     * controlled or public documented dataset
//     * provider/model/version/configuration recorded
//     * temperature recorded
//     * input mode documented
//     * output exported
//     * JSON/script validation passed
//     * latency measured
//     * hallucination detection run
//     * repetitions performed (≥ 3 recommended)
//     * comparative table produced
//     * limitations documented
//     * human review or documented acceptance criteria
//   - Preliminary_valid requires MINIMUM: dataset + provider + model +
//     exported output artifact. No repetitions required.
//   - Attempted_failed means the run was initiated but could not produce
//     valid output (API key missing, provider unavailable, timeout, etc.).
//   - Planned means the run is defined but never executed.

export type BenchClassification = 'planned' | 'attempted_failed' | 'preliminary_valid' | 'formal_valid';

export interface BenchRunInput {
  runId: string;
  datasetId: string;
  datasetType: 'controlled_synthetic' | 'public' | 'real_private' | 'none';
  provider: string;
  model: string;
  modelVersion?: string;
  executionMode: 'deterministic' | 'cloud' | 'chrome_ai' | 'ollama_local' | 'webllm_experimental' | 'colab_delegated';
  inputMode: 'prompt_libre' | 'smart_sample' | 'enhanced_registry' | 'copy_paste_bad_samples' | 'recommended';
  temperature?: number;
  startedAt: string;
  completedAt?: string;
  status: 'completed' | 'failed' | 'timeout' | 'api_error' | 'provider_unavailable' | 'model_not_downloaded' | 'invalid_output';
  failureReason?: string;
  latencyMs?: number;
  jsonValid?: boolean;
  scriptGenerated?: boolean;
  scriptValid?: boolean;
  hallucinationFlags?: string[];
  unsupportedClaimsCount?: number;
  phantomColumnsCount?: number;
  repetitions?: number;
  comparativeTableProduced?: boolean;
  limitationsDocumented?: boolean;
  humanReviewPerformed?: boolean;
  evidenceFiles: string[];
  reviewerNotes?: string;
}

export interface BenchRunResult extends BenchRunInput {
  classification: BenchClassification;
  classificationReason: string;
  claimsAllowed: string[];
  claimsForbidden: string[];
}

export function classifyBenchRun(input: BenchRunInput): BenchRunResult {
  const reasons: string[] = [];
  const claimsAllowed: string[] = [];
  const claimsForbidden: string[] = [];

  // ── Attempted failed ──
  if (input.status !== 'completed') {
    reasons.push(`Run status is '${input.status}', not 'completed'.`);
    if (input.status === 'api_error') reasons.push('API key missing or invalid.');
    if (input.status === 'provider_unavailable') reasons.push('Provider not available in this environment.');
    if (input.status === 'timeout') reasons.push('Run exceeded time limit.');
    if (input.status === 'model_not_downloaded') reasons.push('Model download required but not completed.');
    if (input.status === 'invalid_output') reasons.push('Output is not valid JSON or missing required fields.');

    return {
      ...input,
      classification: 'attempted_failed',
      classificationReason: reasons.join(' '),
      claimsAllowed: ['Run was attempted but failed due to technical reasons. No evidence claim possible.'],
      claimsForbidden: ['AURA produced valid output', 'AURA was benchmarked', 'Provider validated', 'Formal evaluation completed'],
    };
  }

  // ── Check minimum requirements for preliminary_valid ──
  if (!input.datasetId || input.datasetType === 'none') {
    return {
      ...input,
      classification: 'planned',
      classificationReason: 'No dataset specified. Run remains planned.',
      claimsAllowed: [],
      claimsForbidden: ['AURA was benchmarked', 'AURA produced output', 'AURA evaluated any dataset'],
    };
  }

  if (!input.provider || !input.model) {
    return {
      ...input,
      classification: 'planned',
      classificationReason: 'Provider or model not specified. Run remains planned.',
      claimsAllowed: [],
      claimsForbidden: ['AURA was benchmarked', 'AURA produced output', 'AURA evaluated any dataset'],
    };
  }

  if (input.evidenceFiles.length === 0) {
    return {
      ...input,
      classification: 'planned',
      classificationReason: 'No evidence files exported. Run remains planned.',
      claimsAllowed: [],
      claimsForbidden: ['AURA was benchmarked', 'AURA output exported'],
    };
  }

  // ── Check formal_valid criteria ──
  const formalChecks: { ok: boolean; label: string }[] = [
    { ok: input.jsonValid === true, label: 'JSON output validation passed' },
    { ok: input.latencyMs !== undefined && input.latencyMs >= 0, label: 'Latency measured' },
    { ok: (input.hallucinationFlags ?? []).length === 0 && (input.phantomColumnsCount ?? 0) === 0, label: 'No hallucinations or phantom columns detected' },
    { ok: input.scriptGenerated === true && (input.phantomColumnsCount ?? 0) === 0, label: 'Script generated without phantom columns' },
    { ok: (input.repetitions ?? 0) >= 3, label: '3+ repetitions performed' },
    { ok: input.comparativeTableProduced === true, label: 'Comparative table produced' },
    { ok: input.limitationsDocumented === true, label: 'Limitations documented' },
    { ok: input.humanReviewPerformed === true, label: 'Human review or acceptance criteria applied' },
    { ok: input.datasetType !== 'real_private', label: 'Dataset is controlled or public (not private real)' },
  ];

  const failedFormal = formalChecks.filter(c => !c.ok);

  if (failedFormal.length === 0) {
    return {
      ...input,
      classification: 'formal_valid' as BenchClassification,
      classificationReason: 'All formal validation criteria met.',
      claimsAllowed: [
        'AURA was formally benchmarked with documented protocol',
        'Results are repeatable with 3+ runs on the same configuration',
        'Dataset, provider, model, and all parameters are documented',
        'Output was validated for JSON, script, hallucinations, and latency',
        'Limitations are documented',
      ],
      claimsForbidden: [
        'AURA is production-ready',
        'Results generalize to all datasets',
        'AURA corrected real datasets',
        'External independent validation performed',
      ],
    };
  }

  // ── Preliminary valid ──
  const failedLabels = failedFormal.map(c => c.label);

  return {
    ...input,
    classification: 'preliminary_valid',
    classificationReason: `Run completed but formal criteria not met: ${failedLabels.join('; ')}.`,
    claimsAllowed: [
      'AURA produced valid output on controlled dataset',
      `Provider ${input.provider} / ${input.model} was used in controlled run`,
      'Output is preliminary and should not be treated as formal benchmark',
      'Results apply only to this specific configuration and dataset',
    ],
    claimsForbidden: [
      'AURA was formally benchmarked',
      'Results are a formal benchmark',
      'AURA is production-ready',
      'Results generalize to other datasets or providers',
      'External independent validation performed',
      'Chrome AI or Gemini Nano is always available',
    ],
  };
}

export function isFormalValid(run: BenchRunResult): boolean {
  return run.classification === 'formal_valid';
}

export function isPreliminaryValid(run: BenchRunResult): boolean {
  return run.classification === 'preliminary_valid';
}

export function isAttemptedFailed(run: BenchRunResult): boolean {
  return run.classification === 'attempted_failed';
}

export function evaluationStatusMessage(run: BenchRunResult): string {
  switch (run.classification) {
    case 'planned':
      return `[planned] ${run.runId} — Not yet executed.`;
    case 'attempted_failed':
      return `[attempted_failed] ${run.runId} — ${run.classificationReason}`;
    case 'preliminary_valid':
      return `[preliminary_valid] ${run.runId} — Preliminary evidence. Not a formal benchmark.`;
    case 'formal_valid':
      return `[formal_valid] ${run.runId} — Formal benchmark validated. ${run.classificationReason}`;
  }
}