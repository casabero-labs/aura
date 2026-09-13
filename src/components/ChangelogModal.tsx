import React from 'react';
import { X, Calendar } from 'lucide-react';

interface ChangelogModalProps {
  onClose: () => void;
}

interface ChangelogCommit {
  hash: string;
  message: string;
}

interface ChangelogEntry {
  version: string;
  date: string;
  tag: string;
  description: string;
  details: string[];
  commits: ChangelogCommit[];
}

const CHANGELOG_ENTRIES: ChangelogEntry[] = [
  {
    version: 'v1.0 · Laboratorio reproducible',
    date: '14 de julio de 2026',
    tag: 'laboratorio',
    description: 'Campañas comparables de diagnóstico LLM con resultados visuales, método transparente y transferencia directa al flujo normal.',
    details: [
      'La campaña compara tres modelos y tres métodos de entrada mediante 27 diagnósticos; los fallos permanecen visibles y reducen la fiabilidad.',
      'El explorador D3 permite revisar el índice equilibrado, sus dimensiones, la alineación con ground truth, la velocidad y la estabilidad.',
      'Cada resultado puede convertirse en una configuración exacta de modelo, entrada y parámetros para el siguiente diagnóstico de Auditoría.',
      'La exportación incorpora resultados, metodología, glosario, configuración elegida y hashes de integridad.',
    ],
    commits: [],
  },
  {
    version: 'v0.9 · Home y auditoría enfocada',
    date: '20 de junio de 2026',
    tag: 'ui/ux',
    description: 'Home explicativo, navegación superior derecha y workspace de auditoría sin ruido visual.',
    details: [
      'Se separó Home de Auditoría para que el proceso de auditoría sea exclusivamente operativo.',
      'La marca AURA cambia de texto a logo al hacer scroll, siguiendo el estándar Casabero.',
      'Las pruebas de QA se ajustaron para validar que el hero antiguo no aparece en Auditoría.',
    ],
    commits: [
      { hash: '82a78e5', message: 'feat: add focused Aura home and audit workspace' },
    ],
  },
  {
    version: 'v0.8 · Evidencia, sesión y caso incidentes',
    date: '19 de junio de 2026',
    tag: 'evidence',
    description: 'Cierre de evidencia para la tercera entrega, exportación reproducible y validación del flujo sobre CSV completo.',
    details: [
      'Mejoras al perfilado completo frente a previews parciales.',
      'Consolidación de evidencia, notebook externo y documentación de entrega.',
      'Ajustes sucesivos de Chrome AI y limpieza de sesión.',
    ],
    commits: [
      { hash: 'eb61259', message: 'Fix full CSV profiling and evidence wording' },
      { hash: '7104897', message: 'feat(aura): consolidate incidentes evidence and external notebook flow' },
      { hash: 'bce88c2', message: 'feat: complete Loops 1-5b — export/session, semantic ID contamination, Gemini comparison, PDF evidence, Colab notebook' },
      { hash: '755baa6', message: 'Consolidate AURA third delivery docs' },
      { hash: 'b18d7ae', message: 'LOOP 10A.5: Chrome AI single source of truth + clean session' },
      { hash: 'c291736', message: 'Fix R07 capitalization evidence' },
      { hash: 'cb06fe9', message: 'LOOP 10A.4.1: Chrome AI tests alignment after clean availability' },
      { hash: '9137444', message: 'LOOP 10A.4: Chrome AI clean availability - remove expectedInputLanguages' },
    ],
  },
  {
    version: 'v0.7 · Chrome AI y proveedores modernos',
    date: '15-16 de junio de 2026',
    tag: 'providers',
    description: 'Chrome AI, Ollama y Cloud se consolidan como proveedores principales con mejor UX de confianza.',
    details: [
      'Normalización de disponibilidad de Chrome AI y smoke tests.',
      'Guardia de red y recibo de privacidad para diagnóstico local.',
      'Configuración de modelos más clara y progreso visible en flujos largos.',
    ],
    commits: [
      { hash: '37c5480', message: 'fix(chrome-ai): harden availability return-shape handling' },
      { hash: 'dcd2a05', message: 'fix(chrome-ai): fix ready detection, add smoke test fallback, clear stale state' },
      { hash: '05ea464', message: 'feat(chrome-ai): implement first-run guided UX, availability normalizer, network guard, and privacy receipt' },
      { hash: '7193b12', message: 'fix: use chromeDiagnostic instead of renamed chromeAvailability' },
      { hash: '3551d52', message: 'fix: enable chrome ai gemini nano with modern prompt api' },
      { hash: '8d6fe57', message: 'feat: simplify providers with chrome ai ollama and cloud' },
      { hash: '1191277', message: 'chore: remove playwright artifacts from tracking' },
      { hash: '6e1cee5', message: 'test: close progress transparency qa' },
      { hash: 'fb33cfa', message: 'ux: add progress transparency across long-running flows' },
      { hash: 'bd68d1b', message: 'ux: improve model trust settings workspace and help center' },
    ],
  },
  {
    version: 'v0.6 · Reset Casabero del flujo principal',
    date: '15 de junio de 2026',
    tag: 'casabero',
    description: 'Reordenación visual y funcional del flujo post-perfil con jerarquía Casabero y QA dedicada.',
    details: [
      'Se redujo ruido contextual en diagnóstico, script y revisión.',
      'Se corrigieron errores normalizados de WebLLM y restos visuales del perfil.',
      'Se cerraron observaciones de QA antes de consolidar la documentación.',
    ],
    commits: [
      { hash: 'c8331a9', message: 'test: sync post-profile flow qa after casabero reset' },
      { hash: 'd985f5c', message: 'LOOP 07C: remove context-guide cards from Diagnosis/Script/Review; integrate CTAs into result blocks' },
      { hash: '16fcae2', message: 'test: validate post-profile casabero flow' },
      { hash: '25097e9', message: 'ux: reset post-profile flow with casabero companion hierarchy' },
      { hash: 'dd99aba', message: 'chore: preserve normalized AI errors and clean profile leftovers' },
      { hash: '08246f6', message: 'fix: normalize WebLLM cache errors + reset profile screen with casabero minimal hierarchy' },
      { hash: '865274a', message: 'ux: apply casabero aesthetic reset across AURA' },
      { hash: '982f469', message: 'docs: define casabero aesthetic blueprint for AURA' },
      { hash: '863a9c8', message: 'fix: remove duplicate mobile nav visual regression' },
      { hash: '2ba83c9', message: 'ux: apply strict casabero low-risk refinements' },
      { hash: '22956af', message: 'fix: close functional evidence gaps before UX strict audit' },
    ],
  },
  {
    version: 'v0.5 · Pipeline de evidencia reproducible',
    date: '14 de junio de 2026',
    tag: 'evidencia',
    description: 'Consolidación del pipeline de evidencia, laboratorio de calibración y documentación inicial.',
    details: [
      'Ajuste del core UX y calibración de laboratorio.',
      'Preparación de documentación de uso y evidencia.',
    ],
    commits: [
      { hash: '42b67c0', message: 'Refine AURA core UX and calibration lab' },
    ],
  },
  {
    version: 'v0.4 · Perfilado, scoring y reglas semánticas',
    date: '29 de mayo - 6 de junio de 2026',
    tag: 'audit-engine',
    description: 'Fortalecimiento del motor determinista: perfilado de columnas, scoring compuesto y reglas semánticas.',
    details: [
      'Se agregaron reglas de calidad de dataset y documentación de pendientes del motor.',
      'Se registró la entrega del profiler y scoring compuesto.',
    ],
    commits: [
      { hash: '82801a0', message: 'del' },
      { hash: 'd6f4cee', message: 'del_png' },
      { hash: 'a276d34', message: 'docs(changelog): registro de la entrega del profiler y scoring compuesto' },
      { hash: '36363af', message: 'feat(audit): perfilado de columnas + scoring compuesto ponderado' },
      { hash: '73d2e41', message: 'Add semantic dataset quality rules' },
      { hash: '8f1d30a', message: "Merge branch 'main' of https://github.com/casabero-labs/aura" },
      { hash: '39a7e83', message: 'mmm' },
      { hash: 'b317d90', message: 'docs: agregar pendientes consolidados de mejoras para motor determinista' },
    ],
  },
  {
    version: 'v0.3 · Changelog y migración visual Casabero',
    date: '19-20 de mayo de 2026',
    tag: 'design-system',
    description: 'Migración visual a Casabero Design System v6b_swap y primer historial visible dentro de AURA.',
    details: [
      'Paleta warm, tipografía editorial y CSS puro.',
      'Se removieron patrones rotos de Tailwind y se restauraron utilidades necesarias.',
    ],
    commits: [
      { hash: '3789d52', message: 'newdoc' },
      { hash: '53c06a2', message: "Merge branch 'main' of https://github.com/casabero-labs/aura" },
      { hash: 'c941cda', message: 'png' },
      { hash: '63d03bb', message: 'terminando_doc2' },
      { hash: '9eb1030', message: 'feat(ui): add changelog modal (History icon) and capsule theme toggle matching showcase pattern' },
      { hash: 'ca2d7ef', message: 'feat(ui): migrate 2749 CSS classes for all AURA components' },
      { hash: '17d89c3', message: 'feat(ui): migración visual a Casabero Design System v6b_swap (estilo Anthropic)' },
      { hash: 'ca4be75', message: 'fix: restore missing CSS utilities, syntax highlighting, and remove broken Tailwind patterns' },
      { hash: '23f7034', message: 'Corrige border-radius: agrega radius-sm a todos los componentes (botones, cards, inputs, file-drop, modals, toggles)' },
      { hash: '48ea4d5', message: 'Completa migración a Casabero v6b_swap: light-default, Tailwind eliminado, CSS puro' },
    ],
  },
  {
    version: 'v0.2 · Segunda entrega y contrato cognitivo',
    date: '19 de mayo de 2026',
    tag: 'docs/flow',
    description: 'Ordenamiento de evidencia visual, laboratorio experimental, diagnóstico y gobernanza de script.',
    details: [],
    commits: [
      { hash: '1ca7f36', message: 'Actualiza evidencia visual de segunda entrega' },
      { hash: '76b31fa', message: 'Migra interfaz AURA a estandar Casabero' },
      { hash: 'a207c95', message: 'Aclara laboratorio experimental AURA' },
      { hash: 'b1d7a9b', message: 'Consolida reporte diagnostico y gobernanza script' },
      { hash: '166bd0a', message: 'Organiza contrato cognitivo y diagnostico AURA' },
      { hash: 'a11d1b6', message: 'Corrige continuidad y configuracion del flujo AURA' },
    ],
  },
];

const ChangelogModal: React.FC<ChangelogModalProps> = ({ onClose }) => {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel changelog-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-group">
            <Calendar size={18} className="modal-title-icon" />
            <div>
              <p className="modal-eyebrow">historial versionado</p>
              <h2 className="modal-title">Historial de cambios</h2>
            </div>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body changelog-body">
          {CHANGELOG_ENTRIES.map((entry) => (
            <div key={entry.version} className="changelog-entry">
              <div className="changelog-entry-header">
                <div>
                  <span className="changelog-date">{entry.date}</span>
                  <h3 className="changelog-version">{entry.version}</h3>
                </div>
                <span className="changelog-tag">{entry.tag}</span>
              </div>
              <p className="changelog-description">{entry.description}</p>
              {entry.details.length > 0 && (
                <ul className="changelog-details">
                  {entry.details.map((detail) => (
                    <li key={detail}>{detail}</li>
                  ))}
                </ul>
              )}
              <div className="changelog-commits">
                {entry.commits.map(commit => (
                  <div key={commit.hash} className="changelog-commit">
                    <span>{commit.hash}</span>
                    <p>{commit.message}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ChangelogModal;
