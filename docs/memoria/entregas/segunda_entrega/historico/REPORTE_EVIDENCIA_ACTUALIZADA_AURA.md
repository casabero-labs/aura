# Reporte de evidencia actualizada AURA

Fecha de actualización: 2026-05-19

## 1. Alcance

Se regeneraron las pruebas y capturas usadas en la segunda entrega después de la migración visual de AURA al estándar Casabero. El objetivo fue reemplazar las imágenes desalineadas del documento anterior por capturas coherentes con la interfaz actual.

## 2. Pruebas ejecutadas

Las pruebas se ejecutaron con tres datasets sintéticos pequeños ubicados en `docs/evidence/datasets/`:

| Dataset | Filas | Columnas | Score | Hallazgos | Críticos | Advertencias | Info | Duplicados |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `clientes_sucio.csv` | 6 | 5 | 18/100 | 7 | 4 | 1 | 2 | 1 |
| `inventario_sucio.csv` | 6 | 6 | 15/100 | 8 | 4 | 2 | 2 | 1 |
| `operaciones_sucio.csv` | 6 | 6 | 24/100 | 8 | 3 | 4 | 1 | 1 |

Resultados completos:

- `docs/evidence/results/aura_evidence_results.json`
- `docs/evidence/results/aura_evidence_results.md`

## 3. Capturas regeneradas

Las capturas nuevas se guardaron en `docs/evidence/screenshots/` y se duplicaron en `docs/evidence/screenshots/docx_figures/` para inserción en Word.

| Figura | Archivo | Uso en documento |
|---|---|---|
| Figura 5.2 | `aura-clientes-perfil.png` | Perfilamiento actualizado de `clientes_sucio.csv` |
| Figura 5.3 | `aura-inventario-perfil.png` | Perfilamiento actualizado de `inventario_sucio.csv` |
| Figura 5.4 | `aura-operaciones-perfil.png` | Perfilamiento actualizado de `operaciones_sucio.csv` |
| Figura 5.5 | `aura-clientes-diagnostico.png` | Diagnóstico asistido: contrato de entrada y problema observado |
| Figura 5.6 | `aura-clientes-script.png` | Laboratorio experimental de modelos |
| Figura 5.7 | `aura-clientes-revision.png` | Drawer de configuración y contrato técnico |

## 4. Documento actualizado

Se actualizó el Word:

`docs/memoria/entregas/segunda_entrega/Segunda_Entrega_TFM_Joseph_Gari_Borrador_Estructurado.docx`

Cambios aplicados:

- Sustitución de capturas antiguas por seis capturas nuevas.
- Actualización de captions de Figuras 5.2 a 5.7.
- Actualización de la tabla de resultados de datasets.
- Ajuste de redacción para reflejar la migración visual Casabero y evitar capturas que no correspondan con el contenido mostrado.

## 5. Nota de verificación

La verificación estructural del DOCX confirma seis imágenes visibles embebidas (`inline_shapes = 6`). No se pudo ejecutar render visual DOCX a PNG porque el entorno local no tiene `soffice`/LibreOffice instalado.
