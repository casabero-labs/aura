# Resultados sobre Titanic

| Elemento evaluado | Resultado | Interpretación académica | Limitación |
|---|---|---|---|
| Carga y perfilamiento | Titanic (891 filas × 12 columnas) procesado localmente | El motor funciona sin backend. Los datos no abandonan el navegador. | Solo demuestra lectura de CSV. No demuestra escalabilidad. |
| Hallazgos deterministas | 10 issues detectados (nulls, outliers, ghost spaces, long-tail) | Las reglas son reproducibles: misma entrada → mismos hallazgos. | Algunos hallazgos pueden ser falsos positivos sin validación externa. |
| Paquete de evidencia | Fingerprint, columnas y hallazgos encapsulados en EvidenceEnvelopeV2 | El diagnóstico asistido recibe evidencia restringida, no acceso libre a los datos. | El paquete no garantiza que el LLM respete los límites. |
| Diagnóstico asistido | Hipótesis generadas con nivel de confianza por hallazgo | Cada hipótesis está vinculada a un issue concreto del motor determinista. | Se usó harness determinista; no se ejecutó inferencia LLM real en esta captura. |
| Plan de remediación | Acciones clasificadas: auto_safe (1), review_only (7), not_actionable (2) | Las acciones automáticas están limitadas a operaciones sin pérdida de datos. | La clasificación depende de la calidad del diagnóstico previo. |
| Revisión humana | Una acción aprobada, una rechazada | La decisión humana es explícita y trazable por actionId. | No demuestra que el usuario tome decisiones informadas. |
| Script generado | Código Python/Pandas con `def clean_dataset(df)` y transformaciones de acciones aprobadas | El código deriva exclusivamente de acciones aprobadas. Sin intervención del LLM. | El script no se ejecutó. La corrección sintáctica depende del renderer. |
| Contrato verificable | Hash SHA-256, partición accepted/rejected/excluded, verificación fresca | Cada contrato tiene identidad criptográfica. La verificación se re-ejecuta antes de aprobar. | `syntax not_run`: Python no está disponible en el navegador. |
| Bloqueo ante manipulación | Contrato con hash alterado → aprobación bloqueada | El sistema es fail-closed: ante inconsistencia, bloquea en lugar de aprobar. | Solo se probó alteración de hash. No cubre todas las formas de tampering. |
| Resultados ground truth | Dataset sintético con reglas conocidas: precisión, recall y F1 medibles | Permite validar la calidad del motor determinista contra una referencia externa. | El dataset sintético tiene 15 filas; no representa datasets reales complejos. |
