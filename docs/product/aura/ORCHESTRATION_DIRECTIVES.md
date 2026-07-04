# AURA — Orchestration Directives

## Propósito

Este documento fija reglas de orquestación para el desarrollo continuo de AURA y para la futura preparación académica de la entrega final.

No es una sección académica. Es una guía interna para coordinar agentes, fases, revisión humana y selección estratégica de evidencia.

## 1. Revisión humana

La revisión humana queda bajo responsabilidad del usuario.

El orquestador no debe detener el desarrollo por pedir revisión visual humana en cada cierre técnico. La revisión humana se solicitará únicamente cuando el avance llegue a un punto donde la intervención del usuario sea realmente necesaria para validar experiencia, sentido del producto o evidencia observable.

Cuando se solicite revisión humana, el orquestador debe entregar un formato específico, preferiblemente en tabla, con:

| Campo | Descripción |
|---|---|
| Escenario | Qué debe probar el usuario. |
| Precondición | Dataset, configuración o estado necesario. |
| Acción exacta | Pasos concretos que debe ejecutar. |
| Resultado esperado | Qué debería ocurrir si AURA funciona correctamente. |
| Evidencia a capturar | Pantalla, texto, export, log o resultado observable. |
| Resultado observado | Campo para que el usuario lo complete. |
| Veredicto | Pasa / No pasa / Dudoso. |
| Nota | Comentario breve del usuario. |

La revisión humana debe ser breve, ejecutable y útil. No debe convertirse en una carga burocrática.

## 2. Desarrollo interno

El orquestador puede usar issues, prompts, closeouts, addendums y documentos internos para coordinar agentes, siempre que aporten trazabilidad real.

La documentación interna de desarrollo puede ser amplia si ayuda a controlar alcance, claims, pruebas, restricciones y decisiones técnicas.

Sin embargo, esa documentación interna no debe confundirse automáticamente con documentación académica.

## 3. Entrega final académica

Cuando el usuario indique: "preparamos la documentación final para la cuarta entrega", debe entenderse como la entrega definitiva.

El criterio central de esa entrega será:

```text
Qué resultados ofrece AURA y qué se hizo para lograrlos.
```

La entrega académica debe priorizar:

1. resultados verificables de la aplicación;
2. arquitectura funcional;
3. metodología de desarrollo y validación;
4. evidencias de pruebas, builds y restricciones;
5. límites metodológicos honestos;
6. impacto y utilidad del sistema;
7. relación entre objetivos del TFM y resultados obtenidos.

## 4. Selección estratégica de evidencia académica

No todo documento interno debe ir a la entrega final.

Usar solo lo que sirva para defender:

- qué problema resuelve AURA;
- cómo funciona;
- qué componentes fueron construidos;
- qué validaciones se ejecutaron;
- qué resultados se obtuvieron;
- qué límites se reconocen;
- qué aporta el sistema frente a una auditoría manual o dispersa.

Dejar fuera de la entrega académica, salvo anexos muy justificados:

- prompts completos de agentes;
- detalles menores de micro-fixes;
- bitácoras repetitivas;
- documentación que solo coordina tareas internas;
- issues o addendums sin valor directo para resultados, metodología o evidencia.

## 5. Rol del orquestador

El orquestador debe actuar como filtro, no como impresora.

Debe distinguir entre:

| Tipo de material | Uso esperado |
|---|---|
| Evidencia técnica | Sirve para validar que AURA funciona. |
| Bitácora interna | Sirve para coordinar desarrollo. |
| Documento académico | Sirve para defender el TFM. |
| Material descartable | Sirve temporalmente, pero no debe llegar a la entrega. |

La entrega final debe ser sobria, estratégica y orientada a resultados.

## 6. Regla de oro

```text
Para desarrollo: documentar lo necesario para controlar el sistema.
Para academia: seleccionar solo lo necesario para defender el resultado.
```
