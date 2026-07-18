# 03 — Matriz de relaciones UX/UI

La matriz evita separar el defecto visible de su efecto en la tarea.

| Hallazgo | Flujo/estado | Manifestación UI | Consecuencia UX | Criterio | Prioridad |
|---|---|---|---|---|---|
| `AURA-UX-001` | `FL-02`, proveedor no disponible | CTA deshabilitada, alerta sin transición completa, salida solo en stepper | La persona puede interpretar que el objetivo está bloqueado o no descubrir el informe determinista | Visibilidad del estado, recuperación y control | `P1` |
| `AURA-UX-002` | `FL-03`, lectura del informe | Los mismos hallazgos aparecen en dos secciones con totales distintos | Aumenta la incertidumbre sobre cuántos riesgos existen y cuáles requieren decisión | Correspondencia, consistencia y prevención de interpretación errónea | `P1` |
| `AURA-A11Y-001` | `FL-01`, `FL-02`, `FL-08` | Marca clicable sin semántica de botón; toggle móvil sin nombre; menú cerrado presente en árbol accesible | Navegación y retorno pierden nombre, estado y orden comprensible para teclado o lector de pantalla | WCAG 2.1.1, 2.4.3 y 4.1.2 | `P1` |
| `AURA-A11Y-002` | `FL-04`, `FL-07`, modales | Sin rol de diálogo; foco detrás del overlay; cierre sin nombre; Escape inoperante en el modal destructivo | El contexto modal no se anuncia ni contiene de forma fiable la interacción | WCAG 1.3.1, 2.4.3 y 4.1.2 | `P1` |
| `AURA-UI-001` | `FL-03`, móvil | Metadatos con quiebres de palabra y paso actual fuera de vista | Se pierde continuidad al identificar archivo, fecha y etapa | Reflow, jerarquía y escaneabilidad | `P2` |
| `AURA-UX-003` | `FL-01`, recarga móvil | Home reaparece en una posición de desplazamiento intermedia | La primera vista omite identidad, propósito y punto de entrada | Orientación y reconocimiento | `P2` |
| `AURA-CONTENT-001` | `FL-02`, `FL-07` | La ayuda no recupera el error exacto y describe seis etapas frente a cinco visibles | El soporte no confirma el estado ni el contrato real del recorrido | Ayuda contextual, consistencia y recuperación | `P2` |
| `AURA-UI-002` | Navegación global e historial | Marca de nueve formas tipo tablero y CTA oscura rellena frente al patrón Casabero; historial afirma alineación | La identidad declarada y la identidad percibida no coinciden | Consistencia externa y credibilidad | `P2` |
| `AURA-IA-001` | `FL-08`, menú móvil | `Trazabilidad` solo aparece en móvil | La arquitectura de información cambia según el ancho de pantalla | Consistencia y previsibilidad | `P3` |

## Relaciones que concentran riesgo

- `AURA-UX-001` conecta cuatro superficies: Diagnóstico, stepper, Configuración y
  Laboratorio. No es un defecto aislado de un botón.
- `AURA-A11Y-001` y `AURA-A11Y-002` atraviesan navegación, soporte y acciones
  destructivas; su alcance supera una sola pantalla.
- `AURA-UX-002` y `AURA-UI-001` convergen en el informe: una afecta el modelo
  mental del contenido y la otra su legibilidad responsiva.
