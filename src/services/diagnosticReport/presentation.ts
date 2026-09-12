import { IssueSeverity } from '../../types';
import type { DiagnosticFinding, DiagnosticReport, DiagnosticRecommendation } from './types';

export interface DiagnosticPresentationMetric {
  label: string;
  value: string;
  note?: string;
}

export interface DiagnosticPresentationDecision {
  eyebrow: string;
  title: string;
  body: string;
  tone: 'critical' | 'warning' | 'stable';
}

export interface DiagnosticPresentation {
  decision: DiagnosticPresentationDecision;
  metrics: DiagnosticPresentationMetric[];
  executiveSummary: string;
  sourceLabel: string;
  topRisks: DiagnosticFinding[];
  reviewQueue: DiagnosticFinding[];
  recommendations: DiagnosticRecommendation[];
  supportedClaims: string[];
  pendingClaims: string[];
  methodology: string[];
}

const numberFormatter = new Intl.NumberFormat('es-CO');

const sourceLabels: Record<DiagnosticReport['diagnosisSummary']['source'], string> = {
  structured_v2: 'Diagnóstico estructurado',
  legacy_text: 'Diagnóstico asistido en texto curado',
  unavailable: 'Evidencia determinista',
};

const statusLabels: Record<DiagnosticReport['status']['diagnosticStatus'], string> = {
  deterministic_only: 'Solo determinista',
  llm_diagnosis_available: 'Diagnóstico asistido disponible',
  llm_diagnosis_unavailable: 'Diagnóstico asistido no disponible',
};

const severityRank: Record<string, number> = {
  [IssueSeverity.CRITICAL]: 0,
  [IssueSeverity.WARNING]: 1,
  [IssueSeverity.INFO]: 2,
  [IssueSeverity.GOOD]: 3,
};

export const formatDiagnosticSourceLabel = (source: DiagnosticReport['diagnosisSummary']['source']) =>
  sourceLabels[source];

export const formatDiagnosticStatusLabel = (status: DiagnosticReport['status']['diagnosticStatus']) =>
  statusLabels[status];

export const cleanDiagnosticText = (text: string) =>
  text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/[*_`]+/g, '')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?])/g, '$1')
    .trim();

export const splitDiagnosticSentences = (text: string, limit = 4) => {
  const clean = cleanDiagnosticText(text);
  if (!clean) return [];
  return (clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) ?? [clean])
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .slice(0, limit);
};

export const truncatePresentationText = (text: string, maxLength: number) => {
  const clean = cleanDiagnosticText(text);
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, Math.max(0, maxLength - 1)).trimEnd()}...`;
};

export const buildLegacyExecutiveSummary = (report: Pick<DiagnosticReport, 'metadata' | 'evidenceBase'> | {
  score: number;
  issues: unknown[];
  duplicateRows: number;
}, legacyText: string) => {
  const issueCount = 'evidenceBase' in report ? report.evidenceBase.totalIssues : report.issues.length;
  const score = 'metadata' in report ? report.metadata.scoreBase : report.score;
  const duplicateRows = 'evidenceBase' in report ? report.evidenceBase.duplicateRows : report.duplicateRows;
  const candidate = splitDiagnosticSentences(legacyText, 6)
    .find((sentence) => !/^(Regla|Columna|Bad sample|Riesgo|Acción recomendada)\b/i.test(sentence));
  const base = `AURA consolidó ${issueCount} hallazgo(s) determinista(s), score base ${score}/100 y ${duplicateRows} fila(s) duplicada(s).`;
  if (!candidate) return base;
  return truncatePresentationText(`${base} Lectura asistida: ${candidate}`, 520);
};

const sortFindings = (findings: DiagnosticFinding[]) =>
  [...findings].sort((a, b) => {
    const severity = (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4);
    if (severity !== 0) return severity;
    if (a.requiresHumanReview !== b.requiresHumanReview) return a.requiresHumanReview ? -1 : 1;
    return a.title.localeCompare(b.title, 'es');
  });

const buildDecision = (report: DiagnosticReport): DiagnosticPresentationDecision => {
  const critical = report.evidenceBase.criticalIssues;
  const warnings = report.evidenceBase.warningIssues;
  const score = report.metadata.scoreBase;
  const riskCount = report.findingGroups.confirmedRisks.length;

  if (critical > 0 || score < 50) {
    return {
      eyebrow: 'lectura ejecutiva',
      title: 'Revisión humana antes de publicar o corregir datos',
      body: `El diagnóstico puede cerrarse: ${riskCount} de ${report.evidenceBase.totalIssues} hallazgo(s) se clasifican como deterministas y, dentro de ese grupo, ${critical} son críticos. La salida defendible hoy es informe y trazabilidad; la remediación debe ser una rama revisada.`,
      tone: 'critical',
    };
  }

  if (warnings > 0 || score < 80) {
    return {
      eyebrow: 'lectura ejecutiva',
      title: 'Base utilizable con reservas documentadas',
      body: `AURA encontró ${warnings} advertencia(s). El reporte es apto para decisión técnica si se documentan límites, supuestos y columnas que requieren revisión de dominio.`,
      tone: 'warning',
    };
  }

  return {
    eyebrow: 'lectura ejecutiva',
    title: 'Base defendible para análisis posterior',
    body: 'El motor determinista no detectó bloqueos críticos. Mantén la trazabilidad del score y conserva el anexo técnico para auditoría.',
    tone: 'stable',
  };
};

export const buildDiagnosticPresentation = (report: DiagnosticReport): DiagnosticPresentation => {
  const topRisks = sortFindings(report.findingGroups.confirmedRisks).slice(0, 5);
  const reviewQueue = sortFindings(report.findingGroups.humanReviewRequired).slice(0, 4);
  const recommendations = [...report.recommendations]
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 };
      return rank[a.priority] - rank[b.priority] || a.title.localeCompare(b.title, 'es');
    })
    .slice(0, 4);

  return {
    decision: buildDecision(report),
    metrics: [
      { label: 'Score base', value: `${report.metadata.scoreBase}/100`, note: 'No modificado por IA' },
      { label: 'Hallazgos deterministas', value: numberFormatter.format(report.findingGroups.confirmedRisks.length), note: `Incluye ${report.evidenceBase.criticalIssues} críticos` },
      { label: 'Hallazgos', value: numberFormatter.format(report.evidenceBase.totalIssues) },
      { label: 'Filas / columnas', value: `${numberFormatter.format(report.metadata.rowCount)} / ${numberFormatter.format(report.metadata.colCount)}` },
    ],
    executiveSummary: truncatePresentationText(report.diagnosisSummary.executiveSummary, 640),
    sourceLabel: sourceLabels[report.diagnosisSummary.source],
    topRisks,
    reviewQueue,
    recommendations,
    supportedClaims: [
      'Score base calculado por motor determinista.',
      'El diagnóstico asistido contextualiza evidencia; no recalcula el score.',
      'El informe principal puede cerrarse sin generar script.',
    ],
    pendingClaims: [
      ...(report.exportReadiness.scriptExportsReady ? [] : ['Script seguro pendiente o no solicitado.']),
      ...(report.status.hitlRequiredForRemediation ? ['HITL requerido si se ejecuta remediación.'] : []),
      'La corrección automática no está autorizada desde esta pantalla.',
    ],
    methodology: [
      'Separar evidencia determinista, interpretación asistida y decisión humana.',
      'No publicar ni transformar datos sensibles sin política de uso o anonimización.',
      'Usar JSON/CSV como anexos técnicos, no como narrativa principal.',
    ],
  };
};
