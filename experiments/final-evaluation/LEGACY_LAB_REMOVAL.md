# Retirada del laboratorio operativo anterior

Fecha: 10 de julio de 2026.

## Decisión

El laboratorio visible que existía antes del protocolo OE4 no se reutilizará.
Comparaba corridas operativas aisladas y no trabajaba con campañas de 45
unidades, persistencia append-only, oráculos congelados ni revisión formal.

## Qué se retiró

- Página `BenchmarkLab` y su estado de navegación en `App`.
- Acceso desde Configuración y props `onOpenLab`.
- Calibración experimental incrustada en `MainPipeline`.
- Componentes auxiliares antiguos de diseño, panel y gráficos del benchmark.
- Estado `calibration` del flujo visible y su etiqueta en el progreso.
- Pruebas unitarias y E2E que exigían abrir aquella interfaz.

Las sesiones guardadas anteriormente con estado `calibration` se migran a
`diagnosis`, evitando una pantalla vacía después de actualizar AURA.

## Qué se conserva

- Resultados históricos ya guardados en sesiones y exportaciones.
- Servicios de evaluación necesarios para compatibilidad y métricas.
- Protocolo OE4, calendario, corredor y almacenamiento de campañas de Tasks 1–6.
- Hoja de ruta académica y objetivo OE4.

## Continuación

Task 10 creará `BenchmarkCampaignLab` desde cero sobre la infraestructura formal
terminada en Tasks 1–9. La interfaz retirada no debe restaurarse ni tomarse como
referencia funcional.

## Verificación del cierre

- Pruebas enfocadas: 27 de 27 aprobadas.
- Navegador Chromium: 2 de 2 recorridos aprobados; Home no muestra el acceso y
  Configuración no muestra el laboratorio ni su botón anterior.
- Suite completa: 1652 aprobadas y 6 omitidas de forma prevista.
- TypeScript: sin errores.
- Compilación de producción: completada.
- El JavaScript principal bajó de 1017,90 kB a 965,98 kB en las compilaciones
  locales del mismo cierre.
