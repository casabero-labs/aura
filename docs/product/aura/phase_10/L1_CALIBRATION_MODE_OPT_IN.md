# Phase 10 L1 — Integración cautelosa del laboratorio como calibración opcional

## Naturaleza documental

Este documento pertenece a desarrollo continuo de producto. No forma parte de una entrega académica específica.

## Objetivo

Integrar progresivamente la capacidad de laboratorio dentro del flujo principal de AURA sin convertirla en un requisito del sistema ni en el propósito principal del producto.

El flujo base de AURA se mantiene como:

1. Cargar dataset.
2. Perfilar con motor determinista.
3. Generar diagnóstico.
4. Generar propuesta de script.
5. Revisar humanamente.
6. Reauditar o preparar evidencia según corresponda.

La calibración experimental queda como una opción explícita, informada y no obligatoria.

## Decisión de producto

No se debe presentar el laboratorio como un módulo principal separado ni como una promesa de benchmark formal. Debe presentarse como una capa opcional de comparación de configuraciones antes del diagnóstico o antes de seleccionar una propuesta de remediación.

Nombre recomendado en UI:

- `Comparar modelos antes del diagnóstico`
- `Calibración experimental`
- `Comparación opcional de candidatos`

Evitar:

- `Mejor modelo`
- `Benchmark definitivo`
- `Laboratorio obligatorio`
- `Validación formal del modelo`

## Qué puede afirmar AURA

AURA puede afirmar que la calibración experimental:

- compara configuraciones sobre el mismo perfil determinista del dataset;
- registra proveedor, modelo, temperatura, modo de entrada, latencia y validaciones disponibles;
- clasifica la evidencia de cada corrida según su estado;
- puede sugerir el candidato observado con mejor desempeño interno bajo esa ejecución.

## Qué no puede afirmar AURA

AURA no debe afirmar que la calibración experimental:

- prueba cuál modelo es mejor de manera universal;
- reemplaza la revisión humana;
- corrige automáticamente el dataset;
- ejecuta Python dentro de AURA;
- constituye benchmark formal si las corridas no cumplen criterios `formal_valid`;
- garantiza disponibilidad de Chrome AI, Ollama o proveedores cloud.

## Alcance de L1

L1 crea una pieza de UI reutilizable para explicar la calibración opcional antes de activarla.

Archivo agregado:

- `src/components/calibration/CalibrationOptInExplainer.tsx`

Este componente todavía no se conecta al pipeline principal. Esa conexión debe hacerse en una fase posterior para evitar cambiar comportamiento productivo sin pruebas.

## Contrato UX del componente

La pantalla debe dejar claro que:

1. AURA funciona sin calibración.
2. La acción principal debe permitir continuar el flujo normal.
3. La acción secundaria permite activar comparación experimental.
4. La explicación debe decir qué hace y qué no hace.
5. Si no hay condiciones técnicas, debe mostrar la razón por la que la calibración no está disponible.

## Próxima fase recomendada

Phase 10 L2 debe conectar el componente al flujo principal después del perfilamiento o al inicio del diagnóstico, sin eliminar todavía el motor `BenchmarkLab`.

Cambios esperados para L2:

1. Agregar estado controlado de calibración en `MainPipeline`.
2. Mostrar `CalibrationOptInExplainer` después de `ProfileStep` o antes de `DiagnosisStep`.
3. Mantener como acción primaria `Continuar diagnóstico normal`.
4. Usar la acción secundaria para abrir la comparación experimental.
5. No eliminar `BenchmarkLab` hasta que exista una alternativa embebida equivalente.

## Criterios de aceptación para L2

- El usuario puede completar el flujo normal sin tocar calibración.
- La calibración no aparece como requisito.
- La navegación principal ya no debe vender el laboratorio como sección principal.
- No se hacen claims de benchmark formal.
- La evidencia experimental, si existe, se exporta como parte del paquete técnico y no como veredicto absoluto.

## Riesgos controlados

| Riesgo | Mitigación |
|---|---|
| Confundir calibración con benchmark formal | Lenguaje explícito de límites |
| Hacer obligatorio el laboratorio | Acción primaria: continuar flujo normal |
| Romper flujo principal | Integración por fases |
| Inflar el valor del score interno | Renombrar como score interno multicriterio |
| Proveedores no disponibles | Mostrar estado `attempted_failed` o razón de indisponibilidad |

## Veredicto L1

La integración es viable, pero debe hacerse como capacidad opt-in del pipeline, no como eje principal del producto. L1 deja establecida la pieza de explicación y el contrato de comunicación. La integración funcional queda para L2.
