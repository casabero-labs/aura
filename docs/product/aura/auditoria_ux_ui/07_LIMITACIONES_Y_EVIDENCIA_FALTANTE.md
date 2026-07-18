# 07 — Limitaciones y evidencia faltante

## Limitaciones del corte

1. Se auditó una ejecución local y un dataset controlado; no una muestra de
   datasets reales heterogéneos.
2. El proveedor Cloud permaneció sin API key. No se comparó su recuperación con
   Chrome AI u Ollama guardados desde Configuración.
3. Laboratorio se inspeccionó hasta `Preparar experimento`; no se ejecutaron las
   36 llamadas reales indicadas por el protocolo.
4. El evento de descarga JSON no fue capturado por el navegador integrado. No se
   clasifica como defecto porque la evidencia es ambigua.
5. No se inspeccionó visualmente el PDF descargado ni se comprobó el contenido
   de cada archivo de exportación.
6. No hubo prueba con lector de pantalla nativo ni con personas usuarias.
7. La automatización de tabulación no produjo una secuencia estable; las
   conclusiones de foco se limitan a los estados directamente observados.
8. El comportamiento de recarga de Home con `scrollY = 180` se observó una vez y
   puede incluir restauración propia del navegador.
9. Se probaron dos viewports; no toda la matriz de breakpoints, orientación,
   zoom, densidad o sistema operativo.
10. Las capturas de la sesión fueron transitorias y no se incorporaron como
    archivos binarios al repositorio en este corte.

## Evidencia necesaria para elevar confianza

| Área | Evidencia aún no disponible | Hallazgo relacionado |
|---|---|---|
| Recuperación de proveedor | Recorridos guardados con Chrome AI, Ollama y Cloud | `AURA-UX-001` |
| Informe | Datasets con 0, 1 y múltiples combinaciones de riesgo/decisión | `AURA-UX-002` |
| Accesibilidad | VoiceOver/TalkBack, teclado completo, zoom y contraste por estado | `AURA-A11Y-001`, `AURA-A11Y-002`, `AURA-UI-001` |
| Responsividad | Breakpoints intermedios y orientación horizontal | `AURA-UI-001`, `AURA-UX-003` |
| Exportación | Descarga capturada e inspección de ZIP, PDF, JSON y CSV | Fuera de clasificación en este corte |
| Comprensión | Prueba moderada con analista y responsable de decisión | `AURA-UX-001`, `AURA-UX-002`, `AURA-CONTENT-001` |

## Incertidumbres explícitas

- `AURA-UX-003` conserva confianza media por posible intervención del navegador.
- El alcance del patrón modal más allá de los dos modales abiertos conserva
  confianza media.
- `AURA-UI-001` se relaciona con WCAG 1.4.10 como riesgo de legibilidad, no como
  fallo formal demostrado.
