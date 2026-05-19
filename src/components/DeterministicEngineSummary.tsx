import React from 'react';
import { Braces, Calculator, ListChecks, Regex } from 'lucide-react';
import { AuditExecutionEvidence, AuditReport, IssueCategory } from '../types';

interface DeterministicEngineSummaryProps {
  report: AuditReport;
  auditEvidence: AuditExecutionEvidence;
}

const familyDescription = [
  {
    icon: <ListChecks size={14} />,
    title: 'Reglas explícitas',
    body: 'Duplicados, nulos, columnas constantes, tipos mixtos y coherencia temporal.',
    category: IssueCategory.INTEGRITY,
  },
  {
    icon: <Regex size={14} />,
    title: 'Expresiones regulares',
    body: 'Patrones de email, URL, teléfono, moneda, porcentaje, UUID, IP y valores sensibles.',
    category: IssueCategory.HYGIENE,
  },
  {
    icon: <Braces size={14} />,
    title: 'Heurística de tipos',
    body: 'Inferencia de number, string, date, boolean y mixed con señales semánticas por nombre de columna.',
    category: IssueCategory.TYPES,
  },
  {
    icon: <Calculator size={14} />,
    title: 'Estadística descriptiva',
    body: 'Nulos, únicos, cardinalidad, frecuencias, IQR, outliers extremos y Tukey 1.5x.',
    category: IssueCategory.LOGIC,
  },
];

const categoryName: Record<IssueCategory, string> = {
  [IssueCategory.INTEGRITY]: 'Integridad',
  [IssueCategory.HYGIENE]: 'Higiene',
  [IssueCategory.TYPES]: 'Tipos',
  [IssueCategory.LOGIC]: 'Lógica',
  [IssueCategory.SEMANTIC]: 'Semántica',
};

const DeterministicEngineSummary: React.FC<DeterministicEngineSummaryProps> = ({ report, auditEvidence }) => {
  const activeCategories = Array.from(new Set(report.issues.map((issue) => issue.category)));

  return (
    <section className="section" aria-labelledby="engine-summary-title">
      <div className="section-header">
        <div>
          <p className="sec-eye">motor determinista aplicado</p>
          <h2 id="engine-summary-title" className="sec-title">Qué validó AURA en este dataset.</h2>
        </div>
      </div>

      <div className="benchmark-protocol mt-6">
        <div>
          <span>filas evaluadas</span>
          <strong>{report.rowCount.toLocaleString('es-CO')}</strong>
        </div>
        <div>
          <span>columnas evaluadas</span>
          <strong>{report.colCount.toLocaleString('es-CO')}</strong>
        </div>
        <div>
          <span>reglas activadas</span>
          <strong>{report.issues.length.toLocaleString('es-CO')}</strong>
        </div>
        <div>
          <span>tiempo total</span>
          <strong>{auditEvidence.totalDurationMs}ms</strong>
        </div>
      </div>

      <div className="benchmark-grid mt-8">
        {familyDescription.map((family) => {
          const count = family.category
            ? report.issues.filter(i => i.category === family.category).length
            : 0;
          return (
            <div className="benchmark-card" key={family.title}>
              <div className="benchmark-head">
                <span className="benchmark-icon">{family.icon}</span>
                <div>
                  <h3>
                    {family.title}
                    {count > 0 && <span className="family-badge">{count}</span>}
                  </h3>
                  <p>{family.body}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="benchmark-protocol mt-6">
        <div>
          <span>familias con hallazgos</span>
          <strong>{activeCategories.length ? activeCategories.map((category) => categoryName[category]).join(' · ') : 'sin activaciones'}</strong>
        </div>
        <div>
          <span>fingerprint</span>
          <strong>{auditEvidence.datasetFingerprint}</strong>
        </div>
        <div>
          <span>trazabilidad</span>
          <strong>{auditEvidence.trace.length} eventos</strong>
        </div>
      </div>
    </section>
  );
};

export default DeterministicEngineSummary;
