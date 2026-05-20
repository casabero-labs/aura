# Changelog — AURA

Todos los cambios significativos se documentan aquí. Formato: `[YYYY-MM-DD] Tipo: Descripción`

---

## [2026-05-20] feat(ui): migrate 2749 CSS classes for all AURA components

- Migración masiva de CSS: 2,749 líneas añadidas a `src/index.css`
- Referencia visual: `estandar-casabero/examples/frontend/showcase.html` (tokens v6b_swap)
- Buckets migrados:
  - `profile-*`, `dataset-profile`: 45 clases (grid, cards, score bar, severity bars, type chips)
  - `stepper-*`: 6 clases (stepper horizontal con líneas conectoras)
  - `col-*`, `col-detail-*`, `col-iqr-*`, `col-freq-*`, `colstat-*`: 38 clases (ColumnStatsPanel)
  - `audit-*`: 24 clases (AuditLogViewer)
  - `advisor-*`: 16 clases (GeminiAdvisor)
  - `cs-*`, `script-*`, `op-*`: 16 clases (ScriptReview)
  - `benchmark-*`, `lab-*`: 34 clases (BenchmarkLab)
  - `rule-*`, `family-badge--*`: 14 clases (RuleActivationMatrix)
  - `smart-sample-*`, `model-selector-*`, `findings-*`, `finding-*`, `review-*`, `prompt-modal-*`, `improvement-*`: 50+ clases
  - `downloaded-models-*`, `diagnosis-*`, `terminal-*`, `json-*`, `section-*`: componentes varios
  - Utilidades CSS: col-1 a col-12, spacing, texto, flex, border, shadows, z-index, opacity (~80 clases)
  - Extras: custom-markdown, custom-scrollbar, context-guide, script-stream-box, line-clamp
- Tokens `--error`, `--orange`, `--blue` agregados a `:root` y `[data-theme=dark]`
- Diseño: tokens v6b_swap (--ink, --ink2, --ink3, --bg, --surface, --surface-raised, --border, --radius-*)
- 7 workers en paralelo, verificación por bucket con grep
- Commit: `ca2d7ef` — pushed a main

---

## [2026-05-??] feat(ui): migración visual a Casabero Design System v6b_swap

- Migración visual completa al sistema de diseño Casabero v6b_swap (estilo Anthropic)
- Commit: `17d89c3`
- Ver también: `ca4be75`, `23f7034`, `48ea4d5`

---

## [2026-05-14] feat(ui): rediseño editorial y reorganización académica de cabecera AURA

- Rediseño editorial de la cabecera
- Reorganización académica
- Commit: `8732ebe`

---

## [2026-05-??] feat(audit-log): log persistente de auditoría LLM para evidencia académica

- Log persistente de auditoría LLM
- Streaming script generation + LLM diagnosis en PDF
- Commit: `fc4c7df`

---

## [2026-05-??] feat(oe2-oe3-oe4): reordena flujo perfil-diagnóstico, lab full-page, selector modelo, stats reales

- Reordenamiento del flujo principal
- Laboratorio full-page
- Selector de modelo con stats reales
- Commit: `be30dc1`

---

## [2026-04-??] feat(OE1): heurística semántica + IQR expuesto + D3 BoxPlot + ColumnStatsPanel

- Motor heurístico semántico
- IQR expuesto en interfaz
- D3 BoxPlot para visualización
- ColumnStatsPanel
- Commit: `6ecae08`

---

## [2026-04-??] refactor: reestructuración flujo principal + laboratorio

- Separación del flujo principal y el laboratorio
- Commit: `eb65777`

---

## Notas

- Proyecto: AURA — Auditor de calidad de datasets CSV con motor determinista + IA (TFM UNIR)
- Repo: `casabero-labs/aura`
- Stack: React 19 + TypeScript + Vite 6, TailwindCSS CDN (eliminado), CSS puro, Google GenAI SDK, PapaParse, jsPDF, Lucide
- Design System: Casabero v6b_swap (warm editorial — parchment #FAF8F4, off-black #1E1E1C, Playfair Display + Inter)
- Commits anteriores (2025): ver `git log --oneline` para detalle