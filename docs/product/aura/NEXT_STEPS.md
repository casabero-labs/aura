# Next steps — AURA producto

## Naturaleza documental

Este documento es la bitácora viva de desarrollo de producto de AURA. No pertenece a una entrega académica específica.

La tercera entrega académica quedó presentada, evaluada y archivada como histórica. No hay tercera entrega viva.

Este archivo define el siguiente frente operativo del producto. Cualquier agente debe consultar este documento antes de implementar nuevos loops.

---

## Estado real actualizado

AURA ya tiene una base técnica fuerte y varias fases congeladas. El problema actual no es inventar más producto, sino cerrar la última milla de UX, proveedores y evidencia de producción controlada.

| Frente | Estado | Lectura correcta |
|---|---|---|
| Phase 5–9 | Cerradas/congeladas históricamente | No tocar salvo micro-fix documental autorizado |
| Phase 10 L13 | Cerrado | Diagnostic Report Pipeline estabilizado |
| Phase 10 L15 | Cerrado | Flujo principal UX congelado en 5 pasos |
| Proveedores IA | Parcial | Ollama y Chrome AI tienen fixes recientes, pero requieren validación real |
| Calibración experimental | Brecha abierta | Existe como estado/componente/lab, pero no está integrada realmente en Configuración |
| Evidence Pack | Pausado | No iniciar hasta cerrar UX/proveedores/calibración |
| Cuarta entrega académica | No iniciada | Solo se prepara cuando el usuario lo ordene explícitamente |

---

## Flujo principal congelado

El flujo principal visible de AURA queda así:

```text
Carga → Perfil base → Diagnóstico → Reporte diagnóstico → Exportación
```

Equivalente técnico:

```text
upload → profile → diagnosis → diagnostic_report → export
```

Este flujo ya no debe volver a mostrar `calibration`, `script` ni `review` como pasos equivalentes del riel principal.

---

## Ramas fuera del flujo principal

| Rama | Estado esperado | Regla |
|---|---|---|
| Calibración experimental | Configuración / Laboratorio avanzado | No debe aparecer entre Perfil y Diagnóstico |
| Remediación opcional | Desde Reporte diagnóstico | No es obligatoria para exportar informe |
| Revisión humana | Dentro de remediación | Solo aparece si el usuario genera script |
| Anexos de remediación | En Exportación | Solo si existe script aprobado, notebook o HealthDelta |

Decisión central:

> AURA primero explica el dataset. Después, si el usuario lo decide, propone cómo mejorarlo.

---

## Brecha crítica detectada — Calibración en Configuración

La documentación UX dice que la calibración experimental debe vivir en `Configuración / Lab avanzado`, pero el código actual no la implementa realmente dentro de `SettingsPanel`.

Estado observado:

| Elemento | Estado |
|---|---|
| `PipelineState` contiene `calibration` | Sí |
| `CalibrationOptInExplainer` existe | Sí |
| `CalibrationEmbeddedPanel` existe | Sí |
| `BenchmarkLab` existe | Sí |
| Stepper principal ya no muestra calibración | Sí |
| `ProfileStep` avanza directo a `diagnosis` | Sí |
| `SettingsPanel` contiene sección de calibración | No |
| Configuración permite abrir laboratorio/calibración | No claramente |

Conclusión:

> La calibración fue sacada correctamente del camino principal, pero quedó huérfana a nivel UX. Está viva en código, pero no tiene una casa clara dentro de Configuración.

---

## Foco técnico actual — terminar AURA como producto controlado

El siguiente frente operativo debe cerrar esta secuencia:

```text
L25 → L26 → L27 → L28 → L29 → Freeze Phase 10
```

No iniciar nuevas funcionalidades fuera de este cierre.

---

## Roadmap de cierre

| Loop | Nombre | Objetivo | Entregables esperados | Estado |
|---|---|---|---|---|
| L25 | Calibration Settings/Lab Integration | Mover la calibración experimental a Configuración/Lab avanzado sin devolverla al flujo principal | Sección en `SettingsPanel`, acceso a `BenchmarkLab` o `CalibrationEmbeddedPanel`, tests UI, closeout | Pendiente |
| L26 | Provider Final QA | Validar Ollama y Chrome AI después de los fixes recientes | Issues #20–#23 revisados, pruebas manuales/productivas, errores claros, cierre de issues si aplica | Pendiente |
| L27 | Production Deployment Verification | Confirmar que producción sirve el build correcto y no un bundle viejo | Build SHA visible, validación en `aura.casabero.com`, cache sanity check | Pendiente |
| L28 | Visual Evidence Pack | Capturar flujo principal y estados clave en navegador real | Screenshots 1440/1024/768/390, tema claro/oscuro, evidencia ordenada | Pendiente |
| L29 | Final Product QA | Ejecutar typecheck, build, vitest y E2E clave | Matriz QA final, defectos abiertos clasificados, no claims inflados | Pendiente |
| L30 | Freeze Phase 10 | Congelar Phase 10 como cierre de producto actual | `FREEZE_PHASE10.md`, claims permitidos/prohibidos, limitaciones, próximos pasos | Pendiente |

---

## Detalle obligatorio de L25 — Calibración en Configuración/Lab

### Objetivo

Dar a la calibración experimental una ubicación clara dentro de Configuración o Lab avanzado, sin volverla paso obligatorio del usuario.

### Reglas

- No meter `calibration` otra vez entre `profile` y `diagnosis`.
- No agregar calibración al stepper principal.
- No decir “benchmark formal”.
- No decir “modelo ganador”.
- No bloquear el diagnóstico si el usuario no calibra.
- No depender de proveedores reales en tests estándar.
- No tocar `auditEngine` ni scoring determinista.

### UX esperada

En Configuración debe existir una sección tipo:

```text
Laboratorio avanzado
Calibración experimental de modelos
```

Debe explicar:

- qué es calibración;
- para qué sirve;
- que es opcional;
- que no valida formalmente un modelo;
- que no reemplaza el diagnóstico principal;
- que puede usar resultados como contexto adicional.

Acciones posibles:

```text
Abrir laboratorio experimental
Ver resultados de calibración
Volver al diagnóstico
```

### Criterio de aceptación

- El usuario encuentra calibración desde Configuración/Lab avanzado.
- El flujo principal sigue siendo de 5 pasos.
- Carga → Perfil → Diagnóstico sigue funcionando sin calibración.
- El laboratorio no aparece como paso obligatorio.
- Los exports no declaran benchmark formal.
- Typecheck y build pasan.

---

## Detalle obligatorio de L26 — Proveedores IA

Issues vivos a revisar:

| Issue | Tema | Estado esperado |
|---|---|---|
| #20 | Ollama runtime: modelo seleccionado + HTTP 400 body | Validar y cerrar si el fix funciona |
| #21 | Producción sirviendo bundle viejo | Confirmar build desplegado y cache |
| #22 | Chrome AI input too large | Validar prompt budget con Gemini Nano |
| #23 | Ollama stale selected model | Validar reconciliación contra `/api/tags` |

Regla:

> Si el fix ya está en código pero producción sigue fallando, no meter otro parche a ciegas. Primero confirmar build SHA y caché.

---

## Claims permitidos hasta el freeze

- AURA tiene flujo principal UX de 5 pasos.
- AURA separa diagnóstico de remediación opcional.
- AURA puede trabajar con proveedores Chrome AI, Ollama y Cloud, sujeto a disponibilidad.
- AURA conserva calibración como función experimental fuera del flujo principal.
- AURA genera reporte diagnóstico y anexos técnicos cuando existen.
- Los resultados de proveedores y calibración son preliminares si no hay protocolo formal completo.

---

## Claims prohibidos hasta el freeze

- No decir que AURA está `production-ready`.
- No decir que existe benchmark formal definitivo.
- No decir que Chrome AI / Gemini Nano siempre está disponible.
- No decir que Ollama siempre funciona con cualquier modelo instalado.
- No decir que AURA corrige datasets reales automáticamente.
- No decir que la calibración elige el mejor modelo universal.
- No decir que la cuarta entrega académica ya empezó.

---

## Orden recomendado inmediato

1. Ejecutar L25: integrar calibración en Configuración/Lab avanzado.
2. Validar L25 con tests y navegación real.
3. Ejecutar L26: cerrar proveedores IA y issues #20–#23.
4. Ejecutar L27: confirmar build real en producción.
5. Ejecutar L28: capturas visuales.
6. Ejecutar L29: QA final.
7. Ejecutar L30: freeze Phase 10.

---

## Regla de trabajo

Trabajar en `main` solo cuando el cambio sea sustancial, validado y autorizado por el usuario.

No abrir nuevas fases ni nuevos frentes mientras L25–L30 estén pendientes.

Si un agente propone una funcionalidad nueva antes de cerrar L25–L30, debe responderse:

```text
NO-GO: fuera del plan de cierre. Primero terminar Phase 10.
```

---

## Próximo paso autorizado

```text
Phase 10 L25 — Calibration Settings/Lab Integration
```

Este es el próximo movimiento para terminar la brecha actual.
