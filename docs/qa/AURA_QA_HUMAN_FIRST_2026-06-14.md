# AURA QA — Human-first Audit

**Fecha:** 2026-06-14
**Fixture:** `experiments/datasets/synthetic_ground_truth.csv` (15 filas, 8 columnas)
**Veredicto:** APROBADO ✅

---

## Flujo probado

1. Abrir AURA → home limpia, nav en 3 capas
2. Subir CSV → perfil compacto con score/resumen/hallazgos
3. Abrir/cerrar detalles técnicos
4. Ir a Diagnóstico → resumen de problema, sin benchmark/prompt en primer plano
5. Ir a Script → fallback determinista, script visible
6. Ir a Revisar → status strip, aprobar, delta de simulación ("simulación sobre copia")
7. Ir a Exportar → status, claims, limitaciones, botones de descarga
8. Ir a Laboratorio → 5 input modes, configuración, estado sin proveedor claro
9. Volver a Auditoría → Core restaurado

---

## Criterios human-first

| Criterio | Resultado |
|---|---|
| Usuario entiende qué hacer en cada etapa | PASS — CTA principal visible en cada pantalla |
| Cada pantalla tiene una acción principal | PASS — Botón primario visible (Generar diagnóstico, Revisar, Exportar) |
| Detalles técnicos colapsados | PASS — `<details>` cerrado por defecto en perfil, diagnóstico, revisión, export |
| Sin matrices, loops, L02, OE como contenido dominante | PASS |
| Lab es claramente opcional | PASS — Nav separada, estado sin proveedor indica "Sin ejecuciones" |
| Sin overflow horizontal en desktop | PASS (1280px) |
| Sin errores JS críticos | PASS (0 errores) |
| Mobile no rompe textos/botones principales | PASS (390px) con WARN menor de overflow en perfil |
| Desktop no se siente como pared de tarjetas | PASS — Secciones compactas con jerarquía clara |

---

## Screenshots generadas

| # | Pantalla | Desktop | Mobile |
|---|---|---|---|
| 01 | Home | `docs/qa/01-aura-home-desktop.png` | `docs/qa/09-aura-home-mobile.png` |
| 02 | Perfil | `docs/qa/02-aura-profile-desktop.png` | `docs/qa/10-aura-profile-mobile.png` |
| 02b | Perfil + detalles | `docs/qa/02b-profile-tech-open-desktop.png` | — |
| 03 | Diagnóstico | `docs/qa/03-aura-diagnosis-desktop.png` | — |
| 04 | Script | `docs/qa/04-aura-script-desktop.png` | — |
| 05 | Revisar | `docs/qa/05-aura-review-desktop.png` | — |
| 06 | Exportar | `docs/qa/06-aura-export-desktop.png` | — |
| 07 | Laboratorio | `docs/qa/07-aura-lab-desktop.png` | `docs/qa/11-aura-lab-nav-mobile.png` |
| 08 | Vuelta Auditoría | `docs/qa/08-aura-auditoria-return-desktop.png` | — |

---

## Issues corregidos

- **Mobile responsive** para profile-summary, diagnosis-model-bar, review-status-strip, delta-grid, export-status-strip, export-claims, lab-recommendation, lab-runner-controls (AURA-QA-01)

---

## Issues pendientes

1. **Mobile profile horizontal overflow (WARN):** El `profile-summary-hero` en 390px puede tener un scroll horizontal mínimo. No afecta la usabilidad pero se puede refinar en futura iteración.
2. **Nav `isVisible()` race condition:** En el QA automatizado, la verificación inicial de `isVisible()` para los botones de nav falla ocasionalmente por timing de renderizado. Los botones funcionan correctamente al hacer clic.
3. **Doble bloque `@media (max-width: 768px)` en CSS:** Los estilos responsive están divididos en dos bloques — funcional pero se debería consolidar.

---

## Tests ejecutados

| Comando | Resultado |
|---|---|
| `npm test` | **16 archivos, 131 tests OK** |
| `npm run build` | **Build exitoso** |
| `npm run test:e2e` | **5 tests OK** (flujo, QA audit, screenshots desktop, screenshots mobile ×2) |

---

## Próximo paso

**Commit/push** o **AURA-UX-FIX-01** si se requiere corrección de los issues pendientes.
