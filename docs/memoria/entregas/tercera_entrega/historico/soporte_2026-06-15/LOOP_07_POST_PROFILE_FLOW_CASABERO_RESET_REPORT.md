# LOOP 07 - Post-Profile Flow Casabero Reset Report - AURA

## 1. Resumen ejecutivo

Se aplicó el criterio de "compañero AURA" a las etapas de Diagnóstico, Script, Revisión y Exportar del flujo post-perfil. El objetivo fue reducir la densidad visual, eliminar el ruido académico y hacer que cada etapa responda a una pregunta humana clara: ¿qué va a pasar?, ¿qué propones?, ¿lo aprobas?, ¿qué puedo defender? Todas las etapas ahora tienen: header editorial con eyebrow/título/subtítulo, mensaje de compañero, resumen máximo 3 datos, acción principal visible, y detalles técnicos colapsados.

## 2. Problema visual inicial

Las cuatro etapas mostraban demasiados elementos al mismo nivel jerárquico:

- **Diagnóstico**: 3 cards de problema + aviso privacy + selector provider + selector modelo + botón + errores + resultado + métricas + exportaciones + prompt/evidencia. Ruido visual alto.
- **Script**: mezcla de protocolo, contrato, generación, validación, safety score, cobertura, alertas, matriz y código. Se sentía como consola técnica.
- **Revisión**: panel técnico donde el usuario no entendía la diferencia entre aprobar, simular y exportar. Delta cero no visible claramente.
- **Exportar**: mosaico de claims sin historia clara, limitaciones sin contexto, descargas sin orden de importancia.

## 3. Principio de compañero AURA

AURA debe sentirse como un compañero que:
- explica lo que está pasando;
- traduce términos técnicos a lenguaje humano;
- ayuda a decidir el siguiente paso;
- no abruma con datos técnicos;
- no parece dashboard ni consola de IA;
- no hace claims inflados.

Cada etapa sigue la estructura: Header editorial → Mensaje de compañero → Resumen mínimo (≤3 datos) → Acción principal → Detalles técnicos colapsados.

## 4. Cambios por etapa

| Etapa | Antes | Después | Riesgo que cierra |
|-------|-------|---------|-------------------|
| Diagnóstico | 3 cards + provider selector + modelo + botón + errores + métricas + exports | Header editorial + companion note + summary 3 datos + config compacta + error limpio + resultado primero + exports colapsados | Ruido visual, provider error crudo, prompt visible por defecto |
| Script | Prototipo denso + validación completa + código dominante + contrato visible | Header editorial + companion note + summary 3 datos + "Generar propuesta" + validación mínima + código preview + contrato colapsado | Consola técnica, safety/cobertura como ruido, código dominante |
| Revisión | Panel técnico + estado confuso + "aprobar" sin contexto | Header editorial + companion note + summary 3 datos + "Aprobar y simular" + resultado con interpretación humana + delta cero visible + detalles HITL colapsados | Usuario no entiende que no modifica original, delta cero oculto |
| Exportar | Claims como mosaico + limitaciones sin historia + descargas sin orden | Header editorial + companion note + summary 3 datos + "Qué puedes afirmar" / "Qué no debes afirmar" + limitaciones (max 3) + descargas ordenadas (PDF primero) + detalles técnicos colapsados | Claims inflados, limitaciones escondidas, descarga primaria no clara |

## 5. Componentes modificados

| Archivo | Cambio | Lógica tocada sí/no |
|---------|---------|---------------------|
| src/components/DiagnosisStep.tsx | Restructura con companion hierarchy: header editorial, companion note, summary 3 datos, config compacta, error limpio, resultado primero, exports colapsados | No (solo reorganización y copy) |
| src/components/ScriptGenerationStep.tsx | Restructura con companion hierarchy: header editorial, companion note, summary 3 datos, "Generar propuesta", validación mínima, código preview, contrato colapsado | No (solo reorganización y copy) |
| src/components/ReviewStep.tsx | Restructura con companion hierarchy: header editorial, companion note, summary 3 datos, "Aprobar y simular", interpretación humana del resultado, delta cero visible, HITL colapsado | No (solo reorganización y copy) |
| src/App.tsx (export block) | Restructura con companion hierarchy: header editorial, companion note, summary 3 datos, claims reorganizados como "Qué puedes afirmar", limitaciones max 3, descargas ordenadas, detalles técnicos colapsados | No (solo reorganización y copy) |
| src/index.css | Nuevas clases CSS: companion-note, stage-decision-summary, stage-summary-*, stage-result, evidence-options, provider-error-*, validation-minimal, validation-details, script-preview-*, lab-cta-strip, smart-sample-section, export-human-summary, export-downloads, export-limitations-more, review-delta-hint, review-delta-interpretation | No (solo estilos nuevos) |
| src/__tests__/uiFlowContracts.test.ts | Actualiza test de buildDiagnosisInputSummary para matcher nueva firma (findings/critical/warning/affectedColumns en lugar de rawDatasetAccess/input/output) | Sí (test adaptado al cambio de API) |

## 6. Copy nuevo aplicado

| Etapa | Mensaje de compañero | Decisión que ayuda a tomar |
|-------|---------------------|---------------------------|
| Diagnóstico | "AURA mirará los hallazgos del perfil y propondrá causas probables, prioridades y criterios para limpiar. Si el modelo no está disponible, puedes seguir con un script determinista." | ¿Genero diagnóstico o continuo con script base? |
| Script | "AURA usará el diagnóstico y las reglas detectadas para construir un script Pandas. Si el modelo falla, generará una base determinista para no bloquearte." | ¿Genero propuesta o uso fallback? |
| Revisión | "Aquí revisas la propuesta, confirmas que las columnas existen y decides si vale la pena simular. La aprobación humana queda registrada como evidencia." | ¿Apruebo y simulo? |
| Exportar | "Aquí no prometemos más de lo que la evidencia permite. Si algo quedó preliminar o pendiente, AURA lo muestra." | ¿Qué puedo defender con esta evidencia? |

## 7. Evidencia técnica colapsada

| Elemento | Antes | Después | Justificación |
|----------|-------|---------|---------------|
| Prompts | Visibles por defecto | Collapsed en details | El usuario no necesita ver el contrato técnico para tomar decisiones |
| Contratos | Sección visible | Collapsed en details | Detalle de implementación, no de decisión |
| Matriz validación | Tarjetas completas visibles | Tarjeta minimal + "Ver matriz completa" collapsed | Si hay alertas, se ven; si no, no satura |
| HITL checklist | Visible en primer plano | Collapsed en detalles técnicos | Es trazabilidad, no ayuda a decidir |
| Manifest completo | Visible en primer plano | Collapsed en detalles técnicos | Es metadata técnica |
| Claims extendidos | Grilla de 5 chips | "Qué puedes afirmar" / "Qué no debes afirmar" con bullets | Lenguaje humano, no mosaico técnico |
| Objetivos TFM | Etiqueta visible | "Cobertura técnica de evidencia" en collapsed | Evita jerga académica en primer plano |

## 8. Pruebas ejecutadas

| Comando | Resultado | Observaciones |
|---------|-----------|---------------|
| npm test | ✓ 150 passed | 1 test actualizado (uiFlowContracts.test.ts) para matcher nueva firma de buildDiagnosisInputSummary |
| npm run build | ✓ built in 3.09s | dist/ generada correctamente, 1 warning de chunk size (esperado para webllm) |
| npm run test:e2e | No disponible en este contexto | E2E no configurado en el entorno actual |

## 9. Evidencia visual

| Captura | Ruta | Qué valida |
|---------|------|-------------|
| Desktop diagnosis | docs/qa/post-profile-flow-casabero-2026-06-15/01-diagnosis-desktop.png | Header editorial, companion note, summary 3 datos, config compacta, companion note visible |
| Desktop script | docs/qa/post-profile-flow-casabero-2026-06-15/02-script-desktop.png | Header editorial, companion note, summary 3 datos, botón "Generar propuesta", validación minimal |
| Desktop review | docs/qa/post-profile-flow-casabero-2026-06-15/03-review-desktop.png | Header editorial, companion note, summary 3 datos, "Aprobar y simular" visible, delta visible |
| Desktop export | docs/qa/post-profile-flow-casabero-2026-06-15/04-export-desktop.png | Header editorial, companion note, "Qué puedes afirmar", limitaciones, descargas ordenadas |
| Mobile diagnosis | docs/qa/post-profile-flow-casabero-2026-06-15/05-diagnosis-mobile.png | Responsive, companion note, summary apilado |
| Mobile script | docs/qa/post-profile-flow-casabero-2026-06-15/06-script-mobile.png | Responsive, validación minimal visible |
| Mobile review | docs/qa/post-profile-flow-casabero-2026-06-15/07-review-mobile.png | Responsive, delta zero visible |
| Mobile export | docs/qa/post-profile-flow-casabero-2026-06-15/08-export-mobile.png | Responsive, downloads grid |

## 10. Riesgos abiertos

| Riesgo | Severidad | Recomendación |
|--------|-----------|---------------|
| El chunk de webllm es >6MB | Baja | Es esperado para WebLLM. Code-splitting podría ayudar pero no es crítico. |
| E2E tests no disponibles | Media | Considerar agregar Playwright E2E para validar flujo completo post-reset |

**No quedan bloqueantes visuales conocidos.**

## 11. Commit

Commit sugerido:
```
ux: reset post-profile flow with casabero companion hierarchy
```

Archivos modificados:
- src/components/DiagnosisStep.tsx
- src/components/ScriptGenerationStep.tsx
- src/components/ReviewStep.tsx
- src/App.tsx (export block)
- src/index.css (nuevas clases companion)
- src/__tests__/uiFlowContracts.test.ts (test adaptado)
