import React from 'react';
import { ArrowRight, Braces, Calculator, FileSpreadsheet, ListChecks, Regex } from 'lucide-react';
import { AuditReport, IssueCategory } from '../types';

export interface ProfileStageModel {
  stage: string;
  input: string;
  engine: string[];
  output: string;
  next: string;
  activeFamilies: string[];
}

const familyLabels: Record<IssueCategory, string> = {
  [IssueCategory.INTEGRITY]: 'Reglas explicitas',
  [IssueCategory.HYGIENE]: 'Expresiones regulares',
  [IssueCategory.TYPES]: 'Heuristica de tipos',
  [IssueCategory.LOGIC]: 'Estadistica descriptiva',
  [IssueCategory.SEMANTIC]: 'Seguridad y semantica',
};

export const buildProfileStageModel = (report: AuditReport): ProfileStageModel => {
  const activeFamilies = Array.from(new Set(report.issues.map((issue) => familyLabels[issue.category])));

  return {
    stage: 'Perfil del dataset',
    input: `${report.rowCount.toLocaleString('es-CO')} filas, ${report.colCount.toLocaleString('es-CO')} columnas, delimitador "${report.delimiterDetected}".`,
    engine: ['Reglas explicitas', 'Expresiones regulares', 'Heuristica de tipos', 'Estadistica descriptiva'],
    output: `${report.issues.length.toLocaleString('es-CO')} hallazgos reproducibles y paquete estructurado de evidencia.`,
    next: 'La siguiente etapa interpreta causas probables a partir de estos hallazgos.',
    activeFamilies,
  };
};

interface ProfileStageHeaderProps {
  report: AuditReport;
}

const ProfileStageHeader: React.FC<ProfileStageHeaderProps> = ({ report }) => {
  const model = buildProfileStageModel(report);

  return (
    <section className="profile-stage-header" aria-labelledby="profile-stage-title">
      <div className="profile-stage-kicker">
        <FileSpreadsheet size={14} />
        <span>{model.stage}</span>
      </div>
      <div className="profile-stage-grid">
        <div className="profile-stage-main">
          <p className="sec-eye">perfilamiento determinista</p>
          <h2 id="profile-stage-title" className="profile-stage-title">
            Caracterizar el dataset y validar reglas antes de interpretar.
          </h2>
          <p className="profile-stage-copy">
            Esta etapa describe la estructura observada, aplica reglas reproducibles y deja una salida tecnica
            lista para el siguiente paso. Aqui no se diagnostican causas: se construye evidencia.
          </p>
        </div>
        <div className="profile-stage-flow">
          <div>
            <span>entrada</span>
            <strong>{model.input}</strong>
          </div>
          <ArrowRight size={14} />
          <div>
            <span>salida</span>
            <strong>{model.output}</strong>
          </div>
        </div>
      </div>
      <div className="profile-stage-families" aria-label="Familias del motor aplicadas">
        <span><ListChecks size={13} /> Reglas explicitas</span>
        <span><Regex size={13} /> Expresiones regulares</span>
        <span><Braces size={13} /> Heuristica de tipos</span>
        <span><Calculator size={13} /> Estadistica descriptiva</span>
      </div>
      {model.activeFamilies.length > 0 && (
        <p className="profile-stage-note">
          Familias con hallazgos: {model.activeFamilies.join(' · ')}.
        </p>
      )}
    </section>
  );
};

export default ProfileStageHeader;
