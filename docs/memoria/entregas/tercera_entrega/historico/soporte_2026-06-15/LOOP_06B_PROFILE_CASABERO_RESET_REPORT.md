# LOOP 06B - Profile Casabero Reset Report - AURA

**Fecha:** 2026-06-15  
**Rama:** `loop-06b-profile-casabero-reset`  
**Agente:** Director de Arte Frontend Senior / Diseñador UX

---

## 1. Resumen ejecutivo

Rediseño completo de la pantalla "Perfil del dataset" siguiendo los principios de estandar-casabero. La vista principal ahora responde a 4 preguntas de decisión: ¿Qué tan grave es?, ¿Cuáles son los 3 problemas prioritarios?, ¿Qué columnas requieren atención?, ¿Cuál es el siguiente paso? Toda evidencia técnica se ha movido a secciones colapsadas, eliminando el caos visual y mejorando la legibilidad.

## 2. Problema visual inicial

La pantalla de perfil anterior mostraba:
- Score 58/100 junto con 4 estadísticas más
- 8 hallazgos principales en primer plano
- 6 columnas afectadas con chips de severidad
- Macro F1 100% junto con FP 1016 (confusión visual)
- Ingestión, caracterización, boxplot, validación ground truth, matriz de reglas, hallazgos completos y paquete de evidencia todos visibles al mismo nivel
- Botón "Generar diagnóstico" perdido en la interfaz

## 3. Decisiones de rediseño

| Decisión | Ruido que reduce |
|----------|------------------|
| Header editorial corto con "perfil del dataset" | Elimina confusión sobre en qué pantalla está el usuario |
| Resumen de decisión con score + estado textual | Responde inmediatamente "¿Qué tan grave es?" |
| Máximo 3 prioridades de limpieza | Reduce sobrecarga cognitiva de 8 hallazgos a 3 accionables |
| Acción principal con botón claro | Elimina ambigüedad sobre cuál es el siguiente paso |
| Technical details cerrado por defecto | Oculta complejidad innecesaria para usuario no técnico |
| Ground truth con copy "Cobertura de reglas" | Resuelve confusión Macro F1 100% vs FP 1016 |
| Tabla por regla colapsada | Evita cascada visual de 12+ filas de métricas |
| Estilos print para exportación | Previene PDFs de 7 páginas caóticos |

## 4. Cambios por componente

| Archivo | Cambio | Lógica tocada sí/no |
|---------|--------|---------------------|
| `src/components/ProfileStep.tsx` | Reestructurado en 4 bloques: Header editorial, Resumen de decisión, Prioridades, Acción principal. Eliminados severityIcon/severityColor. Limitado a 3 prioridades. | No |
| `src/components/DeterministicValidationPanel.tsx` | Changed `expanded` default to `false`. Updated copy: "Cobertura de reglas esperadas", "Ruido adicional detectado", "Reglas detectadas", "Reglas no esperadas". | No |
| `src/index.css` | Added styles for: profile-editorial-header, profile-decision-summary, profile-priorities, profile-actions. Added print media queries. | No |
| `src/tests/e2e/aura-qa-audit.spec.ts` | Updated selectors: .profile-summary-score-label → .profile-decision-status-label, .profile-summary-stat--critical → .profile-priority-severity--critical, .profile-summary-section → .profile-actions | No |
| `src/tests/e2e/aura-development-loops.spec.ts` | Updated selectors for new profile structure | No |
| `src/tests/e2e/aura-qa-screenshots.spec.ts` | Updated selectors for new profile structure | No |
| `src/tests/e2e/profile-screenshots.spec.ts` | **New.** 4 tests for visual verification: desktop summary, technical closed, technical open, mobile summary | No |

## 5. Antes/después conceptual

| Área | Antes | Después |
|------|-------|---------|
| Header | "perfil del dataset" + subtítulo largo | "perfil del dataset" + "Análisis de calidad y estructura" |
| Score | Ring + 4 stats + label | Ring + estado textual + 1 frase descriptiva |
| Hallazgos | 8 hallazgos en lista | 3 prioridades con columna, severidad, regla, impacto |
| Columnas | 6 chips con "crit/adv" | Eliminados (ya cubiertos en prioridades) |
| Acción | Botón perdido en sección | Botón primario "Generar diagnóstico" + secundario "Ver evidencia técnica" |
| Ground truth | Macro F1 100% dominante | "Reglas detectadas: 3/10" + "Ruido adicional: 1016 FP" |
| Tabla reglas | Expandida por defecto | Colapsada por defecto |
| Técnico | Todo visible al mismo nivel | Cerrado por defecto con copy "Evidencia técnica completa" |
| Print | Sin estilos específicos | Estilos print con resumen ejecutivo primero |

## 6. Ground truth y FP inesperados

**Problema:** Macro F1 100% aparecía como métrica dominante junto con FP 1016, generando confusión visual y conceptual. El usuario no entendía si el dataset estaba perfecto (F1 100%) o tenía muchos falsos positivos.

**Solución:**
1. Reemplazado "Macro F1" por "Reglas detectadas" (mostrando 3/10)
2. Reemplazado "Conteo Global" por "Ruido adicional" (mostrando solo FP)
3. Cambiado "Macro Precisión" por "Precisión" (más directo)
4. Cambiado "Macro Recall" por "Exhaustividad" (más comprensible)
5. Tabla detallada colapsada por defecto
6. Copy actualizado: "Cobertura de reglas esperadas" en lugar de "Métricas por regla contra ground truth"

## 7. Pruebas ejecutadas

```
npm test       → 17 test files, 148 tests, ALL PASSED
npm run build  → vite build success (2.80s)
npm run test:e2e → 7 tests passed (9.2s)
npx playwright test tests/e2e/profile-screenshots.spec.ts → 4 tests passed (3.2s)
```

## 8. Evidencia visual

Capturas generadas en `docs/qa/profile-casabero-reset-2026-06-15/`:

1. `01-profile-desktop-summary.png` - Vista principal del perfil en desktop
2. `02-profile-technical-closed.png` - Perfil completo con technical details cerrado
3. `03-profile-technical-open.png` - Perfil con technical details abierto
4. `04-profile-mobile-summary.png` - Vista móvil del perfil

## 9. Riesgos abiertos

| Riesgo | Severidad | Mitigación |
|--------|-----------|------------|
| Tests E2E dependen de selectores CSS específicos | Baja | Selectores actualizados y tests pasando |
| Estilos print podrían no cubrir todos los componentes | Baja | Estilos básicos implementados, se pueden refinar |
| Cambio de copy en ground truth podría confundir usuarios existentes | Baja | Copy es más claro y directo |

## 10. Commit sugerido

```
ux: reset profile screen with casabero minimal hierarchy

- Restructure ProfileStep into 4 decision blocks: editorial header, decision summary, priorities, action
- Limit visible findings to top 3 priorities
- Update DeterministicValidationPanel copy and collapse table by default
- Add print styles for clean PDF export
- Update E2E tests for new selectors
- Add visual verification screenshots
```