import React from 'react';
import { X, Calendar } from 'lucide-react';

interface ChangelogModalProps {
  onClose: () => void;
}

const CHANGELOG_ENTRIES = [
  {
    date: '20 de mayo de 2026',
    tag: 'feat(ui)',
    commits: ['ca2d7ef'],
    description: 'Migración masiva de CSS — 2,749 clases para todos los componentes de AURA',
    details: [
      'Tokens v6b_swap: --ink, --ink2, --ink3, --bg, --surface, --surface-raised, --border',
      'Profile cards, stepper, ColumnStatsPanel, AuditLogViewer, BenchmarkLab, RuleActivationMatrix',
      'ScriptReview, GeminiAdvisor, DiagnosisStep, ImprovementRunPanel, DatasetProfile',
      'Custom scrollbar, syntax highlighting, line-clamp, context-guide',
      'Utilidades: grid col-1 a col-12, spacing, texto, flex, border, shadows, z-index',
      'Colores semánticos --error, --orange, --blue agregados a :root y [data-theme=dark]',
    ],
  },
  {
    date: '20 de mayo de 2026',
    tag: 'feat(ui)',
    commits: ['17d89c3'],
    description: 'Migración visual completa a Casabero Design System v6b_swap (estilo Anthropic)',
    details: [
      'Paleta warm: parchment #FAF8F4, off-black #1E1E1C, Playfair Display + Inter',
      'TailwindCSS eliminado, CSS puro con custom properties',
    ],
  },
  {
    date: '14 de mayo de 2026',
    tag: 'feat(ui)',
    commits: ['8732ebe'],
    description: 'Rediseño editorial y reorganización académica de cabecera AURA',
    details: [],
  },
  {
    date: '?? de mayo de 2026',
    tag: 'feat(audit-log)',
    commits: ['fc4c7df'],
    description: 'Log persistente de auditoría LLM para evidencia académica',
    details: [
      'Streaming script generation + LLM diagnosis en PDF',
    ],
  },
  {
    date: '?? de mayo de 2026',
    tag: 'feat(oe2-oe3-oe4)',
    commits: ['be30dc1'],
    description: 'Reordena flujo perfil-diagnóstico, lab full-page, selector modelo con stats reales',
    details: [],
  },
  {
    date: '?? de abril de 2026',
    tag: 'feat(OE1)',
    commits: ['6ecae08'],
    description: 'Motor heurístico semántico, IQR expuesto, D3 BoxPlot, ColumnStatsPanel',
    details: [],
  },
  {
    date: '?? de abril de 2026',
    tag: 'refactor',
    commits: ['eb65777'],
    description: 'Reestructuración del flujo principal + laboratorio',
    details: [],
  },
];

const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel changelog-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Calendar size={18} className="modal-title-icon" />
            <h2 className="modal-title">Historial de Cambios</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body changelog-body">
          {CHANGELOG_ENTRIES.map((entry, idx) => (
            <div key={idx} className="changelog-entry">
              <div className="changelog-entry-header">
                <span className="changelog-date">{entry.date}</span>
                <span className="changelog-tag">{entry.tag}</span>
              </div>
              <p className="changelog-description">{entry.description}</p>
              {entry.details.length > 0 && (
                <ul className="changelog-details">
                  {entry.details.map((detail, dIdx) => (
                    <li key={dIdx}>{detail}</li>
                  ))}
                </ul>
              )}
              {entry.commits.length > 0 && (
                <div className="changelog-commits">
                  {entry.commits.map(commit => (
                    <span key={commit} className="changelog-commit">{commit}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;