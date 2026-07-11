import React, { useState } from 'react';
import { createHumanReview } from '../../services/benchmark/humanRubric';
import type { HumanReviewV1 } from '../../services/benchmark/experimentTypes';

interface HumanRubricPanelProps {
  reviewerId: string;
  now: () => string;
  onSave: (review: HumanReviewV1) => Promise<void>;
}

const ScoreSelect: React.FC<{
  label: string;
  value: number;
  onChange: (value: number) => void;
}> = ({ label, value, onChange }) => (
  <label>
    <span>{label}</span>
    <select aria-label={label} value={value} onChange={(event) => onChange(Number(event.target.value))}>
      {[0, 1, 2, 3, 4].map((score) => <option key={score} value={score}>{score}</option>)}
    </select>
  </label>
);

const HumanRubricPanel: React.FC<HumanRubricPanelProps> = ({ reviewerId, now, onSave }) => {
  const [clarity, setClarity] = useState(2);
  const [traceability, setTraceability] = useState(2);
  const [actionability, setActionability] = useState(2);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const review = createHumanReview({
        reviewerId,
        reviewedAt: now(),
        clarity,
        traceability,
        actionability,
        notes,
      });
      await onSave(review);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="oe4-panel" aria-labelledby="oe4-rubric-title">
      <div className="oe4-panel-heading">
        <div><p className="oe4-eyebrow">Revisión humana</p><h2 id="oe4-rubric-title">Rúbrica 0–4</h2></div>
      </div>
      <div className="oe4-rubric-grid">
        <ScoreSelect label="Claridad" value={clarity} onChange={setClarity} />
        <ScoreSelect label="Trazabilidad" value={traceability} onChange={setTraceability} />
        <ScoreSelect label="Accionabilidad" value={actionability} onChange={setActionability} />
      </div>
      <label className="oe4-notes-field">
        <span>Notas de revisión</span>
        <textarea aria-label="Notas de revisión" value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
      </label>
      {error && <p className="oe4-blocker" role="alert">{error}</p>}
      <button type="button" className="btn-p" disabled={saving} onClick={() => void save()}>
        {saving ? 'Guardando…' : 'Guardar evaluación humana'}
      </button>
    </section>
  );
};

export default HumanRubricPanel;
