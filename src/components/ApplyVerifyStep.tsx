import React, { useCallback, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardCheck, FileJson, FileText, Loader2, ShieldAlert, ShieldCheck, Terminal, Upload } from 'lucide-react';
import { buildPythonExecutionBundle, parsePythonExecutionBundle, parsePythonExecutionReceipt, validatePythonExecutionChain } from '../services/remediationExecution/pythonExecutionContract';
import type { PythonExecutionBundleV1, PythonExecutionReceiptV1 } from '../services/remediationExecution/pythonExecutionContract';
import type { VerifiedRemediationEvidence } from '../services/remediationExecution/verifiedRemediationEvidence';
import type { FindingRef, PersistentFindingRef, RemediationVerificationOutcome } from '../services/remediationExecution/remediationVerification';
import { buildScriptHashPayloadV2 } from '../contracts/llm';
import { sha256BytesHex } from '../contracts/llm/hash';
import type { AuditReport, AuditExecutionEvidence } from '../types';
import type { DiagnosisExecutionResult, ScriptContractV2, ScriptValidationResultV2 } from '../contracts/llm';
import type { ApplyVerifyState, ReauditState } from './MainPipeline';

const SHA256_HEX = /^[a-f0-9]{64}$/;
const ENVELOPE_REF = /^env:[a-f0-9]{64}$/;

interface ApplyVerifyStepProps {
  state: ApplyVerifyState;
  report: AuditReport;
  auditEvidence?: AuditExecutionEvidence | null;
  structuredDiagnosis?: DiagnosisExecutionResult | null;
  scriptContractV2?: ScriptContractV2 | null;
  scriptContractVerificationV2?: ScriptValidationResultV2 | null;
  approvedScript?: string;
  sourceFile: File | null;
  sourceDatasetFingerprint?: string | null;
  executionValidationError?: string;
  executionBundleJson?: string;
  executionReceipt?: PythonExecutionReceiptV1;
  reauditState?: ReauditState;
  reauditError?: string;
  verifiedEvidence?: VerifiedRemediationEvidence | null;
  onStateChange: (state: ApplyVerifyState) => void;
  onReceiptChange: (receipt?: PythonExecutionReceiptV1) => void;
  onErrorChange: (error: string) => void;
  onBundleJsonChange: (json: string) => void;
  onAfterFileChange: (afterFile: File | null) => void;
  onSourceFileChange: (file: File | null) => void;
  onVerifiedExecution: (result: VerifiedRemediationExecution) => void | Promise<void>;
  onLog: (stage: string, msg: string) => void;
  onContinue: () => void;
  onBack: () => void;
}

export interface VerifiedRemediationExecution {
  bundle: PythonExecutionBundleV1;
  receipt: PythonExecutionReceiptV1;
  afterFile: File;
}

const RUNNER = 'node experiments/runners/run-aura-remediation.mjs';
const CLI_COMMAND = `${RUNNER} --bundle ./execution-bundle.json --input ./source.csv --output ./corrected.csv --receipt ./receipt.json`;

const formatHashShort = (hash?: string | null) => hash ? `${hash.slice(0, 8)}…${hash.slice(-6)}` : '—';

const OUTCOME_LABELS: Record<RemediationVerificationOutcome, string> = {
  improved: 'Mejora observada',
  unchanged: 'Sin cambio observado',
  worsened: 'Deterioro observado',
  inconclusive: 'Resultado inconcluso',
};

const findingLabel = (finding: FindingRef) =>
  `${finding.ruleId}${finding.column ? ` · ${finding.column}` : ' · dataset'}`;

const FindingList: React.FC<{ findings: FindingRef[] }> = ({ findings }) => (
  findings.length > 0 ? (
    <ul className="reaudit-finding-list">
      {findings.map((finding) => (
        <li key={finding.identityKey}>
          <span>{findingLabel(finding)}</span>
          <small>{finding.count} casos · {finding.affectedPercentage.toFixed(1)}%</small>
        </li>
      ))}
    </ul>
  ) : <p className="reaudit-empty">Ninguno</p>
);

const PersistentFindingList: React.FC<{ findings: PersistentFindingRef[] }> = ({ findings }) => (
  findings.length > 0 ? (
    <ul className="reaudit-finding-list">
      {findings.map((finding) => (
        <li key={finding.identityKey}>
          <span>{findingLabel(finding.after)}</span>
          <small>{finding.before.count} → {finding.after.count} casos</small>
        </li>
      ))}
    </ul>
  ) : <p className="reaudit-empty">Ninguno</p>
);

const ApplyVerifyStep: React.FC<ApplyVerifyStepProps> = ({
  state,
  report,
  auditEvidence,
  structuredDiagnosis,
  scriptContractV2,
  scriptContractVerificationV2,
  approvedScript,
  sourceFile,
  sourceDatasetFingerprint,
  executionValidationError,
  executionBundleJson,
  executionReceipt,
  reauditState,
  reauditError,
  verifiedEvidence,
  onStateChange,
  onReceiptChange,
  onErrorChange,
  onBundleJsonChange,
  onAfterFileChange,
  onSourceFileChange,
  onVerifiedExecution,
  onLog,
  onContinue,
  onBack,
}) => {
  const [afterFile, setAfterFile] = useState<File | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [copyLabel, setCopyLabel] = useState('Copiar comando');
  const [storedBundleJson, setStoredBundleJson] = useState(executionBundleJson ?? '');

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(CLI_COMMAND);
      setCopyLabel('Copiado');
      setTimeout(() => setCopyLabel('Copiar comando'), 2000);
    } catch {
      setCopyLabel('Error al copiar');
    }
  };

  const preconditions = useMemo(() => {
    const errors: string[] = [];
    const fingerprint = sourceDatasetFingerprint ?? auditEvidence?.datasetSha256 ?? null;
    if (!fingerprint || !SHA256_HEX.test(fingerprint)) errors.push('El SHA-256 del CSV fuente no es válido.');
    if (!sourceFile) errors.push('El archivo CSV fuente no está disponible; volvé a seleccionarlo.');
    if (!scriptContractV2) errors.push('No hay contrato de script V2.');
    if (!SHA256_HEX.test(scriptContractV2?.scriptHash ?? '')) errors.push('El hash del script V2 no es 64-hex.');
    const verif = scriptContractVerificationV2;
    if (!verif || verif.valid !== true || verif.pythonSyntax.state === 'failed') {
      errors.push('La verificación V2 del script falló.');
    }
    if (!scriptContractV2) return { ok: false, errors };
    const currentScript = approvedScript ?? '';
    if (currentScript !== scriptContractV2.scriptText) {
      errors.push('El script aprobado difiere del contrato V2.');
    }
    if ((scriptContractV2.acceptedActionIds ?? []).length === 0) {
      errors.push('No hay acciones aceptadas en el plan.');
    }
    const diagReceiptHash = structuredDiagnosis?.executionReceipt?.receiptHash;
    const diagEnvelopeRef = structuredDiagnosis?.evidenceEnvelopeRef;
    const contractInputRef = scriptContractV2.inputReceiptRef;
    if (!diagReceiptHash || !SHA256_HEX.test(diagReceiptHash)) errors.push('El receiptHash del diagnóstico no es 64-hex.');
    if (!diagEnvelopeRef || !ENVELOPE_REF.test(diagEnvelopeRef)) errors.push('El evidenceEnvelopeRef del diagnóstico no tiene formato env:<sha256>.');
    if (!contractInputRef || !SHA256_HEX.test(contractInputRef)) errors.push('El inputReceiptRef del contrato V2 no es 64-hex.');
    if (diagReceiptHash && contractInputRef && diagReceiptHash !== contractInputRef) {
      errors.push('La referencia del recibo de diagnóstico no coincide con el contrato V2.');
    }
    return { ok: errors.length === 0, errors, fingerprint };
  }, [sourceDatasetFingerprint, auditEvidence, scriptContractV2, scriptContractVerificationV2, approvedScript, sourceFile, structuredDiagnosis]);

  const handleReuploadSource = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const f = files[0];
    const buf = new Uint8Array(await f.arrayBuffer());
    const hash = sha256BytesHex(buf);
    if (preconditions.fingerprint && hash !== preconditions.fingerprint) {
      onErrorChange('El SHA-256 del archivo seleccionado no coincide con el dataset congelado.');
      return;
    }
    onErrorChange('');
    onSourceFileChange(f);
    onLog('execution.source', `re-selected source SHA256=${hash.slice(0, 12)}`);
  };

  const prepareBundle = useCallback(async () => {
    if (!preconditions.ok || !preconditions.fingerprint || !scriptContractV2 || !sourceFile) return;
    try {
      const fingerprint = preconditions.fingerprint;
      const hashPayload = buildScriptHashPayloadV2(scriptContractV2 as Parameters<typeof buildScriptHashPayloadV2>[0]);
      const bundle = buildPythonExecutionBundle({
        generatedAt: new Date().toISOString(),
        executionId: `exec:${fingerprint.slice(0, 12)}`,
        approvedScriptHash: scriptContractV2.scriptHash,
        beforeDatasetSha256: fingerprint,
        scriptText: scriptContractV2.scriptText,
        scriptHashPayload: hashPayload,
        inputReceiptRef: structuredDiagnosis?.executionReceipt?.receiptHash,
        evidenceEnvelopeRef: structuredDiagnosis?.evidenceEnvelopeRef,
      });
      const json = JSON.stringify(bundle, null, 2);
      onBundleJsonChange(json);
      setStoredBundleJson(json);
      onStateChange('ready');
      onLog('execution.prepare', `bundle generated hash=${bundle.bundleHash?.slice(0, 12) ?? '?'}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onErrorChange(msg);
      onLog('execution.prepare.error', msg);
      onStateChange('not_prepared');
    }
  }, [preconditions, sourceFile, scriptContractV2, structuredDiagnosis, onBundleJsonChange, onStateChange, onErrorChange, onLog]);

  const downloadBundle = () => {
    if (storedBundleJson) {
      const blob = new Blob([storedBundleJson], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'execution-bundle.json'; a.click();
      URL.revokeObjectURL(url);
    }
  };

  const downloadSourceCsv = () => {
    if (!sourceFile) return;
    const url = URL.createObjectURL(sourceFile);
    const a = document.createElement('a');
    a.href = url; a.download = 'source.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const startAwaitingFiles = () => {
    onStateChange('awaiting_external_output');
  };

  const handleValidate = async () => {
    if (!afterFile || !receiptFile || !sourceFile || !storedBundleJson) return;
    setValidating(true);
    onStateChange('validating');
    onReceiptChange(undefined);
    onErrorChange('');
    try {
      const [sourceBuf, afterBuf, receiptText] = await Promise.all([
        sourceFile.arrayBuffer().then(b => new Uint8Array(b)),
        afterFile.arrayBuffer().then(b => new Uint8Array(b)),
        receiptFile.text(),
      ]);
      const sourceHash = sha256BytesHex(sourceBuf);
      if (preconditions.fingerprint && sourceHash !== preconditions.fingerprint) {
        throw new Error('El CSV fuente no coincide byte a byte con el dataset congelado.');
      }
      const bundle = parsePythonExecutionBundle(storedBundleJson);
      const receipt = parsePythonExecutionReceipt(receiptText);
      const chainErrors = validatePythonExecutionChain({
        bundle,
        receipt,
        sourceCsv: sourceBuf,
        outputCsv: afterBuf,
      });
      if (chainErrors.length > 0) {
        throw new Error(`Cadena inválida: ${chainErrors.join('; ')}`);
      }
      if (receipt.syntax.status !== 'passed' || receipt.execution.status !== 'passed') {
        throw new Error(`Ejecución no exitosa: syntax=${receipt.syntax.status} execution=${receipt.execution.status}`);
      }
      const decoder = new TextDecoder();
      const afterText = decoder.decode(afterBuf);
      if (!afterText.trim()) {
        throw new Error('El CSV corregido está vacío.');
      }
      onReceiptChange(receipt);
      onAfterFileChange(afterFile);
      onStateChange('verified');
      onLog('execution.verified', `receipt=${receipt.receiptHash.slice(0, 12)} rows=${receipt.output?.rowCount} cols=${receipt.output?.columnCount}`);
      await onVerifiedExecution({ bundle, receipt, afterFile });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      onErrorChange(msg);
      onAfterFileChange(null);
      onStateChange('invalid');
      onLog('execution.invalid', msg);
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="step-card apply-verify-step" data-testid="apply-verify-step">
      <div className="step-header">
        <h2 className="step-heading">Aplicar y verificar</h2>
        <p className="step-subtitle">
          Descargá el bundle y el CSV fuente, ejecutá el script en el runner local controlado y subí el resultado junto con el recibo.
        </p>
      </div>

      {preconditions.errors.length > 0 && (
        <div className="evidence-options" data-testid="apply-verify-preconditions">
          <ShieldAlert size={16} />
          <div>
            <strong>Precondiciones no cumplidas</strong>
            <ul style={{ margin: 'var(--space-xs) 0 0 var(--space-lg)', fontSize: '14px' }}>
              {preconditions.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {!sourceFile && preconditions.errors.some(e => e.includes('archivo CSV fuente')) && (
        <div className="btn-row" style={{ marginTop: 'var(--space-sm)' }}>
          <label className="btn-p btn-sm" style={{ cursor: 'pointer' }}>
            <FileText size={14} /> Seleccionar CSV fuente
            <input
              type="file"
              accept=".csv"
              style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
              onChange={(e) => handleReuploadSource(e.target.files)}
              data-testid="apply-verify-reselect-source"
            />
          </label>
        </div>
      )}

      {state === 'not_prepared' && preconditions.ok && (
        <button className="btn-p" onClick={prepareBundle} data-testid="apply-verify-prepare">
          <Terminal size={16} /> Preparar ejecución
        </button>
      )}

      {state === 'ready' && storedBundleJson && (
        <div data-testid="apply-verify-ready">
          <div
            data-execution-bundle-json={storedBundleJson}
            style={{ display: 'none' }}
          />
          <div className="evidence-options" style={{ marginBottom: 'var(--space-md)' }}>
            <ShieldCheck size={16} />
            <div>
              <strong>Ejecución preparada.</strong> Descargá los dos archivos y ejecutá el comando abajo en tu terminal.
            </div>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-muted)', marginBottom: 'var(--space-xs)' }}>
            El comando debe ejecutarse desde la raíz del repositorio (<code>aura/</code>).
          </p>
          <div className="btn-row">
            <button className="btn-p btn-sm" onClick={downloadBundle} data-testid="apply-verify-download-bundle">
              <FileJson size={14} /> execution-bundle.json
            </button>
            <button className="btn-p btn-sm" onClick={downloadSourceCsv} data-testid="apply-verify-download-source">
              <FileText size={14} /> source.csv
            </button>
          </div>
          <div className="apply-verify-mono-block" style={{ marginTop: 'var(--space-md)' }} data-testid="apply-verify-command">
            <code>{CLI_COMMAND}</code>
          </div>
          <div className="btn-row" style={{ marginTop: 'var(--space-xs)' }}>
            <button className="btn-s btn-sm" onClick={copyToClipboard} data-testid="apply-verify-copy-command">
              <ClipboardCheck size={14} /> {copyLabel}
            </button>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--ink-muted)', marginTop: 'var(--space-xs)' }}>
            AURA no ejecuta Python. Cuando termine, arrastrá o seleccioná los dos archivos de salida.
          </p>
          <div className="btn-row" style={{ marginTop: 'var(--space-md)' }}>
            <button className="btn-s btn-sm" onClick={startAwaitingFiles} data-testid="apply-verify-await-files">
              <Upload size={14} /> Ya ejecuté, subir archivos
            </button>
          </div>
        </div>
      )}

      {(state === 'awaiting_external_output' || state === 'validating' || state === 'invalid') && (
        <div data-testid="apply-verify-import">
          <div className="evidence-options">
            <Upload size={16} />
            <div>
              <strong>{state === 'validating' ? 'Validando…' : 'Importar salida Python externa'}</strong>
              <p style={{ fontSize: '14px', marginTop: 'var(--space-xxs)' }}>
                Seleccioná corrected.csv y receipt.json juntos.
              </p>
            </div>
          </div>
          <div className="btn-row">
            <label className="btn-p btn-sm" style={{ cursor: 'pointer' }}>
              <FileText size={14} /> corrected.csv
              <input
                type="file"
                accept=".csv"
                style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
                onChange={(e) => setAfterFile(e.target.files?.[0] ?? null)}
                data-testid="apply-verify-after-file"
              />
            </label>
            <label className="btn-p btn-sm" style={{ cursor: 'pointer' }}>
              <FileJson size={14} /> receipt.json
              <input
                type="file"
                accept=".json"
                style={{ position: 'absolute', width: '1px', height: '1px', margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
                onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                data-testid="apply-verify-receipt-file"
              />
            </label>
          </div>
          {afterFile && <p style={{ fontSize: '13px', marginTop: 'var(--space-xs)' }}>CSV: {afterFile.name} ({afterFile.size} bytes)</p>}
          {receiptFile && <p style={{ fontSize: '13px' }}>Recibo: {receiptFile.name} ({receiptFile.size} bytes)</p>}

          {!validating && state === 'invalid' && executionValidationError && (
            <div className="evidence-options" style={{ marginTop: 'var(--space-md)' }} data-testid="apply-verify-error">
              <ShieldAlert size={16} />
              <div>
                <strong>Error de validación</strong>
                <p style={{ fontSize: '14px', marginTop: 'var(--space-xxs)' }}>{executionValidationError}</p>
              </div>
            </div>
          )}

          <div className="btn-row" style={{ marginTop: 'var(--space-md)' }}>
            <button
              className="btn-p"
              disabled={!afterFile || !receiptFile || validating}
              onClick={handleValidate}
              data-testid="apply-verify-validate"
            >
              {validating ? <Loader2 size={16} className="spin" /> : <ShieldCheck size={16} />}
              Validar ejecución
            </button>
          </div>
        </div>
      )}

      {state === 'verified' && executionReceipt && (
        <div data-testid="apply-verify-verified">
          <div className="evidence-options" style={{ marginBottom: 'var(--space-md)' }} role="status">
            <CheckCircle2 size={16} />
            <div>
              <strong>Ejecución verificada; resultado reauditable</strong>
            </div>
          </div>
          <div className="apply-verify-info-grid">
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Python</span>
              <span className="apply-verify-info-value">{executionReceipt.pythonVersion}</span>
            </div>
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Pandas</span>
              <span className="apply-verify-info-value">{executionReceipt.pandasVersion ?? '—'}</span>
            </div>
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Plataforma</span>
              <span className="apply-verify-info-value">{executionReceipt.platform}</span>
            </div>
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Duración</span>
              <span className="apply-verify-info-value">{executionReceipt.execution.durationMs} ms</span>
            </div>
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Filas</span>
              <span className="apply-verify-info-value">{executionReceipt.output?.rowCount ?? '—'}</span>
            </div>
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Columnas</span>
              <span className="apply-verify-info-value">{executionReceipt.output?.columnCount ?? '—'}</span>
            </div>
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Hash salida</span>
              <span className="info-value mono">{formatHashShort(executionReceipt.afterDatasetSha256)}</span>
            </div>
            <div className="apply-verify-info-item">
              <span className="apply-verify-info-label">Hash recibo</span>
              <span className="info-value mono">{formatHashShort(executionReceipt.receiptHash)}</span>
            </div>
          </div>

          {reauditState === 'running' && (
            <div className="evidence-options" style={{ marginTop: 'var(--space-md)' }} data-testid="apply-verify-reaudit-running" role="status" aria-live="polite">
              <Loader2 size={16} className="spin" />
              <div>
                <strong>Reauditando resultado…</strong>
                <p style={{ fontSize: '14px', marginTop: 'var(--space-xxs)' }}>
                  AURA está ejecutando el mismo motor determinista sobre el CSV corregido.
                </p>
              </div>
            </div>
          )}

          {reauditState === 'failed' && (
            <div className="evidence-options" style={{ marginTop: 'var(--space-md)' }} data-testid="apply-verify-reaudit-failed" role="alert">
              <ShieldAlert size={16} />
              <div>
                <strong>La reauditoría falló.</strong>
                <p style={{ fontSize: '14px', marginTop: 'var(--space-xxs)' }}>
                  El recibo Python sigue siendo válido, pero la remediación no puede declararse verificada.
                </p>
                {reauditError && <p style={{ fontSize: '13px', color: 'var(--ink-muted)' }}>{reauditError}</p>}
              </div>
            </div>
          )}

          {reauditState === 'completed' && verifiedEvidence && (
            <div className="reaudit-comparison" data-testid="apply-verify-reaudit-summary">
              <section aria-labelledby="reaudit-comparison-title">
                <header className="reaudit-comparison-header">
                  <div>
                    <p className="reaudit-eyebrow">Comparación determinista</p>
                    <h3 id="reaudit-comparison-title">Antes y después</h3>
                  </div>
                  <strong className="reaudit-outcome" data-outcome={verifiedEvidence.verification.outcome}>
                    {OUTCOME_LABELS[verifiedEvidence.verification.outcome]}
                  </strong>
                </header>

                <div className="reaudit-period-grid">
                  <article>
                    <h4>Antes</h4>
                    <dl>
                      <div><dt>Score</dt><dd data-testid="reaudit-before-score">{verifiedEvidence.verification.before.score}</dd></div>
                      <div><dt>Hallazgos</dt><dd data-testid="reaudit-before-issues">{verifiedEvidence.verification.before.issueCount}</dd></div>
                      <div><dt>Filas</dt><dd data-testid="reaudit-before-rows">{verifiedEvidence.verification.before.rowCount}</dd></div>
                      <div><dt>Columnas</dt><dd data-testid="reaudit-before-columns">{verifiedEvidence.verification.before.columnCount}</dd></div>
                    </dl>
                  </article>
                  <article>
                    <h4>Después</h4>
                    <dl>
                      <div><dt>Score</dt><dd data-testid="reaudit-after-score">{verifiedEvidence.verification.after.score}</dd></div>
                      <div><dt>Hallazgos</dt><dd data-testid="reaudit-after-issues">{verifiedEvidence.verification.after.issueCount}</dd></div>
                      <div><dt>Filas</dt><dd data-testid="reaudit-after-rows">{verifiedEvidence.verification.after.rowCount}</dd></div>
                      <div><dt>Columnas</dt><dd data-testid="reaudit-after-columns">{verifiedEvidence.verification.after.columnCount}</dd></div>
                    </dl>
                  </article>
                </div>

                {verifiedEvidence.verification.estimatedCellsModified !== null && (
                  <p className="reaudit-estimate" data-testid="reaudit-estimated-cells">
                    Cambios estimados: <strong>{verifiedEvidence.verification.estimatedCellsModified} celdas</strong>
                  </p>
                )}

                <div className="reaudit-findings-grid">
                  <article>
                    <h4>Resueltos <span data-testid="reaudit-resolved-findings">{verifiedEvidence.verification.findings.resolved.length}</span></h4>
                    <FindingList findings={verifiedEvidence.verification.findings.resolved} />
                  </article>
                  <article>
                    <h4>Persistentes <span data-testid="reaudit-persistent-findings">{verifiedEvidence.verification.findings.persistent.length}</span></h4>
                    <PersistentFindingList findings={verifiedEvidence.verification.findings.persistent} />
                  </article>
                  <article>
                    <h4>Nuevos <span data-testid="reaudit-new-findings">{verifiedEvidence.verification.findings.new.length}</span></h4>
                    <FindingList findings={verifiedEvidence.verification.findings.new} />
                  </article>
                </div>

                <p className="reaudit-limitation">
                  La reauditoría usa el mismo motor determinista de AURA y no sustituye validación de dominio
                </p>

                <details className="reaudit-trust-chain">
                  <summary>Cadena de evidencia</summary>
                  <dl>
                    <div><dt>Diagnóstico</dt><dd>{formatHashShort(verifiedEvidence.verification.diagnosisReceiptHash)}</dd></div>
                    <div><dt>Script</dt><dd>{formatHashShort(verifiedEvidence.verification.approvedScriptHash)}</dd></div>
                    <div><dt>Bundle</dt><dd>{formatHashShort(verifiedEvidence.verification.executionBundleHash)}</dd></div>
                    <div><dt>Recibo Python</dt><dd>{formatHashShort(verifiedEvidence.verification.pythonReceiptHash)}</dd></div>
                    <div><dt>CSV corregido</dt><dd>{formatHashShort(verifiedEvidence.verification.correctedDatasetSha256)}</dd></div>
                  </dl>
                </details>
              </section>
            </div>
          )}

          {reauditState === 'completed' && (
            <div className="btn-row" style={{ marginTop: 'var(--space-md)' }}>
              <button className="btn-p" onClick={onContinue} data-testid="apply-verify-continue">
                <ArrowRight size={16} /> Ir a Exportación
              </button>
            </div>
          )}
        </div>
      )}

      {state !== 'verified' && (
        <div className="btn-row" style={{ marginTop: 'var(--space-lg)' }}>
          <button className="btn-s btn-sm" onClick={onBack} data-testid="apply-verify-back">
            <ArrowLeft size={14} /> Volver a Revisión
          </button>
        </div>
      )}
    </div>
  );
};

export default ApplyVerifyStep;
