# Revisión y corrección del motor de reglas de AURA

Fecha: 5 de octubre de 2026. Verificaciones realizadas sobre el código local; no certifican el despliegue público.

## Qué estaba pasando

AURA leía el archivo y calculaba estadísticas, pero algunas reglas dejaban pasar problemas reales. Otras generaban avisos sobre datos válidos. La pantalla tampoco mostraba todos los hallazgos ni permitía reconstruir con claridad el puntaje.

La revisión cubre las 37 reglas identificadas en el código, la lectura del archivo, los tipos de columna, el puntaje, la presentación de los hallazgos y la revisión posterior a una corrección. Se añadió una ejecución real de Gemini Nano para comprobar el cambio del registro de columnas, descrita más abajo. Esa ejecución comprueba compatibilidad; no certifica que todas las interpretaciones del modelo sean correctas.

## Cambios comprobados con tu archivo

| Problema | Resultado corregido |
|---|---|
| Documento tratado como número | Se trata como texto. `0011223344` conserva sus ceros. No recibe promedio ni cálculo de valores extremos. |
| Documentos repetidos sin hallazgo | Aparecen los grupos de registros 1–3, 7–8 y 10–11. Son seis registros involucrados, no seis clientes que se deban borrar. |
| Fecha imposible | `2024-13-01`, registro 6, aparece como crítico. |
| Nombre con espacios o `null` | Ambos cuentan como información faltante: registros 6 y 12. El marcador `null` también conserva su aviso específico, sin descontar dos veces por esa ausencia. |
| Variaciones de escritura | Las diferencias de mayúsculas y acentos aparecen como avisos. La regla detecta diferencias; la persona decide la escritura correcta. |
| Valores permitidos desconocidos | Se pueden declarar antes de cargar el CSV. Con las reglas de ejemplo, `actvo` y `ACTIVO` no cumplen la lista declarada para `estado`. |
| Puntaje difícil de explicar | Cada descuento aparece con su regla, su gravedad y sus puntos. |
| Hallazgos ocultos | La pantalla muestra todos, incluidos los informativos. Cada columna muestra sus avisos reales. |

Los números de registro comienzan en 1 y excluyen la cabecera. Son registros del CSV; un campo con saltos de línea puede ocupar varias líneas físicas. Las reglas nuevas incluyen hasta 20 números de registro como muestra. Algunas reglas anteriores todavía ofrecen ejemplos y conteos, sin una lista completa de registros.

Un detalle de la revisión anterior merece corregirse: el texto literal `null` ya tenía un aviso. Lo que fallaba era su coherencia con el conteo de vacíos. Tampoco se habían borrado los ceros del dato original: el error era tratarlo como una medición numérica.

## Reglas propias del archivo

Antes de cargar el CSV, abre **Reglas propias del archivo (opcional)** y carga [clientes.rules.json](clientes.rules.json). Después carga `clientes_sucio.csv`.

Ese ejemplo declara documento obligatorio, único y de 10 caracteres; nombre obligatorio; estados permitidos; fechas ISO; y montos enteros no negativos. Es una declaración de prueba revisable, no una norma universal para cualquier archivo de clientes.

```json
{
  "documento": { "type": "identifier", "required": true, "unique": true, "length": 10 },
  "nombre": { "type": "string", "required": true },
  "estado": { "allowedValues": ["activo", "inactivo", "pendiente"] },
  "fecha_alta": { "type": "date", "dateFormat": "ISO" },
  "monto_ultima_compra": { "type": "number", "min": 0, "integer": true }
}
```

Las opciones disponibles son `type`, `required`, `unique`, `allowedValues`, `dateFormat`, `min`, `max`, `integer` y `length`. La aplicación rechaza opciones desconocidas, límites contradictorios y nombres de columnas que no existen. Una revisión posterior conserva las mismas reglas y la misma fecha de referencia.

Sin una declaración de unicidad, un documento repetido pide revisión. Con `unique: true`, incumple una regla explícita y se vuelve crítico. Con `unique: false`, la repetición está permitida. En ninguno de estos casos se autoriza eliminar filas automáticamente.

Las listas de valores son exactas: `ACTIVO` no coincide con `activo`. Si ambas formas son válidas, deben incluirse ambas. Una categoría como `UNKNOWN` puede declararse válida y entonces no cuenta como vacío.

No se inventó una lista de ciudades. Para decidir si `Sahagun` es válido o debe escribirse `Sahagún`, hace falta una lista aprobada. La regla de variaciones ayuda cuando hay varias escrituras del mismo nombre, pero no es un catálogo geográfico.

## Pruebas con archivos conocidos

Se comparó el motor anterior del commit `5e951a7` con el código corregido. Los datos originales se conservaron. Los resultados están en [results.json](results.json); incluyen la fecha usada y huellas de los archivos del motor para identificar la versión probada.

| Archivo | Registros | Hallazgos antes → después | Puntaje antes → después | Lectura del resultado |
|---|---:|---:|---:|---|
| Clientes sucio | 12 | 9 → 13 | 31 → 22 | Aparecen errores que antes faltaban. Con reglas declaradas: 16 hallazgos, 7 críticos y puntaje 0. |
| Clientes ground truth | 7 | 1 → 0 | 82 → 100 | Desaparece el falso aviso por el documento con ceros. También pasa las reglas declaradas. |
| Iris de UCI | 150 | 4 → 2 | 85 → 96 | Las medidas decimales ya no se confunden con identificadores dañados. Quedan igualdad de observaciones y medidas poco frecuentes, que requieren interpretación. |
| Titanic del repositorio | 891 | 8 → 9 | 64 → 60 | Dos ausencias de `Embarked` ya no se esconden por afectar a menos del 5 %. |
| Archivo sintético del repositorio | 15 | 15 → 16 | 0 → 0 | Se añade el identificador repetido que existe en los datos. |
| Clientes de fase 8 | 50 | 28 → 35 | 0 → 0 | Mejora la detección de vacíos y fechas. Este archivo tiene problemas de estructura; véase la limitación más abajo. |

Iris procede de [UCI](https://archive.ics.uci.edu/dataset/53/iris), licencia CC BY 4.0. La copia conserva los 150 registros originales, incluida su escritura de decimales. Titanic es la copia ya existente en el repositorio; no se afirma una verificación externa de su origen.

Además se hicieron copias de prueba con errores conocidos: medida vacía, medida negativa, especie inexistente y una edad faltante entre 891 registros. Las pruebas comprobaron los registros esperados y que los originales no cambiaron.

Un puntaje 100 significa que estas reglas no produjeron descuentos. No prueba que todos los datos sean verdaderos, completos para el negocio o correctos en el mundo real.

## Revisión de las 37 reglas

La tabla distingue cambios implementados de límites que siguen necesitando contexto. Revisar una regla no significa que tenga una prueba independiente para cada caso posible.

| Regla | Qué se revisó y qué hace ahora |
|---|---|
| Filas iguales | Sigue detectando igualdad completa. Se cambió a aviso de revisión; igualdad no prueba que una observación sobre. El motor solo permite autorizar borrado cuando quien lo llama declara expresamente esa decisión. La carga normal no lo hace. |
| Identificador repetido | Nueva. Busca repeticiones por columna de identificación, aunque `id` sea distinto. Respeta `unique: true/false`. No incluye todavía claves formadas por varias columnas. |
| Fecha no válida | Nueva. Comprueba días, meses, años bisiestos y horas. Un tipo de fecha ya no sirve para dar por válido un mes imposible. |
| Valor no permitido | Nueva. Comprueba listas declaradas y formato de fecha declarado. No adivina catálogos. |
| Número fuera de la regla | Nueva. Comprueba tipo, mínimo, máximo e integridad declarados. Evita convertir valores que exceden la precisión segura. |
| Longitud no permitida | Nueva. Comprueba una longitud exacta cuando se declara. No presume una longitud universal de documento. |
| Vacíos | Ahora detecta cualquier cantidad, incluso menos del 5 %. Cuenta espacios y marcadores; respeta categorías declaradas válidas. Un campo obligatorio vuelve crítico el hallazgo. |
| Columna constante | Mantiene el aviso. Ya recomienda revisar, en vez de eliminar: una constante puede ser metadato válido. |
| Tipos mezclados | Los identificadores no se confunden con números; respeta tipos declarados. El conteo antiguo sigue representando la columna implicada, no una lista exacta de celdas incorrectas. |
| Cabecera extensa | Conserva el aviso de conveniencia. Un nombre largo no demuestra un error en los datos. |
| Espacios al inicio o final | Conserva detección y ejemplo original. Quitar espacios puede ser una normalización permitida; no rellena información. |
| Texto con caracteres dañados | Reconoce más secuencias de texto mal decodificado. No autoriza una reparación sin conocer la codificación correcta. |
| Marcadores como `null` | Usa la misma definición de ausencia que las estadísticas. Mantiene evidencia y evita otro descuento por el mismo vacío. `000` y `999` no se consideran vacíos por defecto. |
| Formatos de fecha mezclados | Mantiene el aviso. No convierte una fecha ambigua sin decidir primero el orden día/mes. |
| Mayúsculas o acentos distintos | Ahora reconoce también grupos como `Monteria`, `Montería` y `MONTERIA`. Son avisos de revisión. |
| Variantes parecidas | Conserva la comparación aproximada entre categorías. La semejanza no prueba equivalencia. No autoriza unir categorías. |
| Muchas categorías poco frecuentes | Conserva el aviso informativo. Se interpreta como distribución, no como error confirmado. |
| Espacios dobles | Conserva detección. No elimina espacios internos sin revisión. |
| Símbolos sospechosos | Acepta apóstrofes, guiones y puntuación común en nombres. Evita acusar nombres como `O'Connor, Anne-Marie`. |
| Enlaces mal formados | Valida con el lector de URL del navegador. Acepta terminaciones modernas, consultas y fragmentos; no acusa celdas vacías como enlaces rotos. |
| Texto muy largo | Conserva el aviso de más de 300 caracteres. Ese límite es orientativo y no autoriza truncar texto. |
| Texto aparentemente numérico | Respeta texto declarado, ceros iniciales, valores fuera de precisión segura y columnas de identificación. No propone perder información mediante conversión. |
| Fecha oculta en texto | Mantiene el aviso de posible tipo. No convierte automáticamente ni decide fechas ambiguas. |
| Identificador terminado en `.0` | Comprueba el texto original. Ya no acusa medidas decimales de Iris como identificadores dañados. Sigue pidiendo una decisión sobre la forma correcta del identificador. |
| Hora `00:00:00` repetida | Comprueba rangos de hora válidos. Medianoche puede ser válida y no se elimina automáticamente. |
| Rangos como `18-25` | Evita confundir fechas, teléfonos e identificadores con rangos demográficos. Puede ser una categoría válida; se revisa. |
| Negativo en campo positivo | Conserva el aviso crítico para campos reconocidos. Un mínimo declarado sustituye ese control para evitar dos avisos del mismo incumplimiento. |
| Valor muy alejado del resto | Mantiene la regla estadística de 3 veces el rango central. No se aplica como medición a identificadores. No prueba que el valor sea falso. |
| Valor moderadamente alejado | Mantiene el aviso informativo de 1,5 veces el rango central. No autoriza cambiar la observación. |
| Correo inválido | Comprueba columnas de correo reconocidas por nombre o perfil. Omite vacíos y marcadores ya contados como ausencia. No verifica que la cuenta exista. |
| Longitud de teléfono distinta | Detecta incluso una diferencia menor al 5 %. Es revisión, porque pueden coexistir países y formatos válidos. |
| Posibles datos sensibles | Inspecciona el valor original. Para tarjetas añade comprobación del dígito de control. Detectar una IP no basta para concluir que identifica a una persona. |
| Fecha futura | Detecta cualquier cantidad y usa una fecha de referencia conservada. El aviso pide decidir si esas fechas están permitidas; una fecha futura puede ser válida. |
| Fin anterior a inicio | Ya no convierte un inicio vacío en 1970. Usa fechas comprobadas y no adivina el orden de fechas ambiguas. |
| Columnas temporales redundantes | Conserva la comparación entre columnas relacionadas. No autoriza borrar una columna sin revisar su uso. |
| Columnas con contenido equivalente | Conserva la comparación de contenido. La equivalencia observada no prueba que una columna sobre. |
| Identificación mezclada con descripciones | Conserva la comparación orientativa entre tokens de identificación y texto. Pide revisión del uso de la columna. |

## Puntaje y pantalla

La fórmula actual es `máximo(0, redondear(100 − suma de descuentos))`. Cada descuento usa la gravedad real de su hallazgo. Se retiró el cambio de fórmula que antes aparecía al llegar a 100 registros.

También se incorporaron descuentos que antes quedaban fuera del detalle y se impidió que un marcador vacío descontara dos veces por la misma ausencia. Los puntajes antiguos y nuevos no son directamente comparables como medida de precisión. El puntaje es un índice de estas reglas, no una probabilidad de que el archivo esté bien.

La pantalla muestra todos los hallazgos y el detalle del cálculo. La frase por columna es **Sin hallazgos en las reglas evaluadas**, cuando corresponde. Esa frase no garantiza que la columna esté libre de cualquier problema.

Capturas comprobadas en navegador: [archivo sucio](screenshots/clientes-general.png), [pantalla móvil](screenshots/clientes-mobile.png) y [reglas declaradas](screenshots/clientes-con-reglas.png).

## Límites y resultados que no se deben exagerar

- No se rellenaron nombres, correos, documentos ni fechas. No se borraron registros de tus archivos.
- El ground truth de clientes inventa información de Marta que no se puede recuperar del CSV. Sus decisiones de redondeo y corrección tampoco se deben aplicar sin una regla aprobada.
- Los registros 1 y 3 del archivo sucio no son iguales en todas las columnas. Comparten documento; eso exige revisar identidad, no llamarlos duplicado exacto.
- La prueba de fase 8 tiene tres registros con campos de más. La carga normal de la aplicación los rechaza. El ensayo del motor sobre los registros ya interpretados se conserva para comparar reglas, pero no certifica una carga correcta de ese CSV.
- El catálogo de errores de fase 8 también contiene expectativas que no coinciden con sus datos o dependen de la fecha. No se alteró el motor para producir esos avisos incorrectos. El informe actualizado registra 23 de 29 reglas esperadas; seis siguen sin coincidir.
- Los indicadores del ensayo existente miden si una regla aparece. No son una medición completa de precisión por registro. Los avisos sin etiqueta de verdad se reportan aparte. No se afirma precisión global del 100 %.
- Las reglas basadas en el nombre de una columna pueden equivocarse. Las declaraciones del archivo ofrecen una forma explícita de corregir esa interpretación.
- Siguen pendientes reglas de negocio más amplias: claves de varias columnas, catálogos externos aprobados, comparación aproximada de entidades y evidencia completa por registro para todas las reglas antiguas.
- Se ejecutó Gemini Nano con Titanic y se recapturó su referencia sin modificar sus respuestas. El parser y el validador estricto se conservaron. El modelo todavía puede pedir revisión humana por motivos distintos del nombre de una columna.

## Nombres normales de columna y prueba real de Nano

Se retiró de la lista de nombres confusos el patrón que bloqueaba `Name`, `id`, `value`, `key`, `data` y otros nombres comunes. Se conservaron los controles para nombres como `l1l1`, `0O0`, vacíos y solo símbolos. Los nombres repetidos siguen exigiendo revisión.

Una columna normal ya no impide, por su nombre, generar una corrección de espacios aprobada. Las pruebas comprueban ese recorrido para `Name`, `id`, `value`, `key` y `data`. También comprueban que los nombres realmente confusos siguen bloqueados y que dos columnas llamadas `Name` no se confunden entre sí.

El cambio altera la evidencia que recibe la IA. Se cargó Titanic en AURA local, en Chrome 154 con Gemini Nano, y se generó un diagnóstico nuevo el 5 de octubre de 2026, entre las 11:26 y las 11:28 de Colombia. Nano respondió los nueve hallazgos en nueve solicitudes, y el resultado pasó el contrato estricto. La captura se exportó directamente de la sesión real a `src/__tests__/fixtures/nano-titanic-fragments.fixture.json`; sus respuestas no se editaron.

Recibo de esa ejecución: `75b035e6476569f9ae2fc59d31428d51e18e18b29fc84f12e64e2a58be4819c8`. [Captura del informe](screenshots/nano-titanic-real.jpg).

En esta ejecución Nano pidió revisión humana para `Name`. Se respeta esa decisión. El cambio elimina el bloqueo automático por el nombre, pero no promete que el modelo vaya a autorizar cualquier corrección.

## Cómo repetir las comprobaciones

Desde la raíz del repositorio:

```sh
node experiments/rule-engine/evaluate.mjs --refresh-benchmark
cd src
npm run verify
npm run build
npm run test:e2e -- tests/e2e/rule-engine.spec.ts
```

La primera orden compara los seis archivos sin modificar sus valores. `verify` revisa tipos y ejecuta las pruebas, incluidas las protecciones del pipeline. La última prueba carga el CSV y las reglas en un navegador, revisa hallazgos y vuelve a cargar el archivo limpio.

Resultado de la verificación local: 166 archivos de pruebas aprobados; 2.219 pruebas aprobadas y 6 omitidas. También pasó la compilación para publicación. Las dos pruebas de navegador verifican carga, reglas, revisión de hallazgos, pantalla móvil y reinicio con el archivo limpio. Las cuatro pruebas de puntuación pasan, y las ocho pruebas de protección del pipeline también.

El informe previo del ensayo se conservó en [baseline](baseline/), y el actual está en [final_deterministic_evidence.md](../results/final_deterministic_evidence.md).
