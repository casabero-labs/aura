import React, { useState } from 'react';
import {
  ArrowLeft,
  Search,
  ChevronDown,
  Info,
  Lock,
  AlertTriangle,
  HelpCircle,
  FileText,
  ClipboardList,
  Brain,
  Download,
  FlaskConical,
  ShieldCheck,
  Settings,
  FileCode2,
} from 'lucide-react';

interface HelpCenterProps {
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  searchText: string;
  content: React.ReactNode;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['inicio-rapido', 'flujo-completo', 'privacidad'])
  );

  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const sections: HelpSection[] = [
    {
      id: 'inicio-rapido',
      title: 'A. Inicio rápido',
      icon: <Info size={14} />,
      searchText: 'inicio rapido que es aura auditoria csv diagnostico local first navegador',
      content: (
        <div className="help-section-body">
          <p>AURA es un entorno de auditoría de calidad de datos para archivos CSV. Su trabajo principal es convertir un dataset en evidencia: perfil técnico, hallazgos, diagnóstico asistido, propuesta de limpieza, revisión humana y exportables.</p>
          <div className="help-callout">
            <strong>Regla mental:</strong>
            <p>AURA no intenta adivinar tu negocio. Detecta señales reproducibles, separa lo formal de lo preliminar y te pide validar las decisiones que pueden cambiar datos.</p>
          </div>
          <ul className="help-checklist">
            <li>Usa <strong>Auditoría</strong> para cargar, perfilar, diagnosticar, revisar y exportar.</li>
            <li>Usa <strong>Laboratorio</strong> cuando ya tienes un reporte y quieres comparar modelos o configuraciones.</li>
            <li>Usa <strong>Configuración</strong> para elegir Chrome AI, Ollama o Cloud, ajustar temperatura y revisar privacidad.</li>
            <li>Exporta evidencia antes de cerrar si necesitas defender el análisis después.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'flujo-completo',
      title: 'B. Flujo completo de auditoría',
      icon: <ClipboardList size={14} />,
      searchText: 'flujo completo carga perfil diagnostico script revision exportar delta salud',
      content: (
        <div className="help-section-body">
          <ol className="help-flow-list">
            <li>
              <strong>1. Cargar dataset</strong>
              <p>Selecciona un CSV. AURA detecta delimitador, columnas y volumen inicial en el navegador.</p>
              <p className="help-decision">Valida que el nombre del archivo, columnas y vista previa correspondan al dataset esperado.</p>
            </li>
            <li>
              <strong>2. Perfil determinista</strong>
              <p>El motor revisa tipos, nulos, duplicados, cardinalidad, outliers, formatos, columnas sospechosas y reglas semánticas disponibles.</p>
              <p className="help-decision">No todo hallazgo implica borrar o corregir. Decide si el hallazgo es error, regla del dominio o limitación del archivo.</p>
            </li>
            <li>
              <strong>3. Diagnóstico asistido</strong>
              <p>El modelo recibe evidencia estructurada, no el CSV completo. Su respuesta ayuda a priorizar causas probables y criterios de limpieza.</p>
              <p className="help-decision">Trata el diagnóstico LLM como preliminar. Si contradice el perfil o inventa columnas, manda el perfil.</p>
            </li>
            <li>
              <strong>4. Propuesta de script</strong>
              <p>AURA genera una propuesta Python/Pandas y valida columnas inexistentes, operaciones destructivas y cobertura de hallazgos.</p>
              <p className="help-decision">Aprueba solo si entiendes qué transforma, qué elimina y qué deja igual.</p>
            </li>
            <li>
              <strong>5. Revisión humana y simulación</strong>
              <p>La limpieza se prueba sobre una copia en memoria. AURA compara score, filas, columnas y señales antes/después.</p>
              <p className="help-decision">Un delta positivo ayuda, pero no reemplaza revisión de negocio. Un delta neutro o negativo exige ajustar el script.</p>
            </li>
            <li>
              <strong>6. Exportación</strong>
              <p>Descarga PDF, JSON técnico, CSV de hallazgos, script aprobado y notebook Colab cuando aplique.</p>
              <p className="help-decision">Exporta el paquete que permita reproducir y explicar lo que hiciste, no solo una captura bonita.</p>
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: 'lectura-resultados',
      title: 'C. Cómo leer los resultados',
      icon: <Brain size={14} />,
      searchText: 'score severidad critico warning informativo hallazgos motor determinista evidencia',
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>Score 80-100</dt><dd>Calidad alta para las reglas evaluadas. Aun así revisa hallazgos críticos, columnas clave y límites del dataset.</dd>
            <dt>Score 50-79</dt><dd>Calidad intermedia. Hay señales que pueden sesgar análisis o entrenamientos si no se atienden.</dd>
            <dt>Score 0-49</dt><dd>Riesgo alto. Prioriza hallazgos críticos antes de usar el dataset como fuente confiable.</dd>
            <dt>Crítico</dt><dd>Problema que puede invalidar análisis posteriores: identificadores contaminados, duplicados severos, nulos dominantes o contradicciones fuertes.</dd>
            <dt>Advertencia</dt><dd>Problema que requiere revisión: formatos mixtos, outliers, cardinalidad rara o cobertura incompleta.</dd>
            <dt>Informativo</dt><dd>Contexto útil sin acción obligatoria inmediata.</dd>
            <dt>Evidencia formal</dt><dd>Resultado reproducible del motor determinista o validación interna.</dd>
            <dt>Evidencia preliminar</dt><dd>Interpretación que requiere juicio humano, especialmente texto generado por modelos.</dd>
          </dl>
          <div className="help-callout">
            <strong>Prioridad recomendada:</strong>
            <p>Primero críticos que afecten identidad, duplicidad y columnas de decisión. Después nulos/formatos. Por último outliers y mejoras cosméticas.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'privacidad',
      title: 'D. Privacidad y datos',
      icon: <Lock size={14} />,
      searchText: 'privacidad local chrome ai ollama cloud api key datos sensibles csv navegador',
      content: (
        <div className="help-section-body">
          <ul>
            <li><strong>CSV original:</strong> se procesa en el navegador. AURA no lo sube automáticamente.</li>
            <li><strong>Chrome AI:</strong> ejecuta el modelo integrado en el navegador cuando está disponible.</li>
            <li><strong>Ollama:</strong> usa un servidor local en <code>localhost:11434</code>. Los datos no salen de tu máquina salvo que tu configuración de red lo haga.</li>
            <li><strong>Cloud:</strong> envía evidencia estructurada al proveedor elegido: nombres de columnas, estadísticas agregadas, hallazgos y resumen. No envía el archivo completo por diseño.</li>
            <li><strong>API keys:</strong> se guardan en <code>localStorage</code> del navegador. No las pegues en reportes, capturas o issues públicos.</li>
          </ul>
          <div className="help-callout help-callout--warning">
            <strong>Datos sensibles:</strong>
            <p>Si el CSV contiene información personal, médica, financiera, legal o protegida, usa modos locales y revisa permisos antes de exportar o compartir evidencia.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'configuracion',
      title: 'E. Configuración de modelos',
      icon: <Settings size={14} />,
      searchText: 'configuracion modelos chrome ai gemini nano ollama cloud temperatura contrato prompt idioma ingles español una llamada webgpu',
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>Chrome AI</dt><dd>Opción local recomendada cuando el navegador la soporta. Ideal para privacidad y baja fricción, con disponibilidad dependiente de Chrome y del modelo instalado.</dd>
            <dt>Ollama local</dt><dd>Opción local robusta si ya tienes modelos instalados. Requiere abrir Ollama y permitir el origen de AURA si el navegador bloquea CORS.</dd>
            <dt>Cloud</dt><dd>Útil cuando necesitas más capacidad o estabilidad de respuesta. Implica enviar evidencia estructurada a un proveedor externo.</dd>
            <dt>Temperatura</dt><dd>Para auditoría usa valores bajos, normalmente 0.1 o 0.2. Valores altos aumentan variación y riesgo de respuestas inventadas.</dd>
            <dt>Contrato</dt><dd>Instrucciones que limitan cómo debe responder el modelo. Si no sabes qué tocar, conserva el valor por defecto.</dd>
            <dt>¿Por qué aparecen inglés y español?</dt><dd>No son dos diagnósticos ni dos llamadas. En V2, AURA conserva en inglés la instrucción técnica estable, incorpora en español la evidencia procedente del motor y compone ambas piezas en una sola solicitud exacta, certificada por su hash. Un prompt completamente en español solo identifica una sesión histórica V1.</dd>
            <dt>WebLLM</dt><dd>Modo experimental. Puede fallar por caché, IndexedDB o descarga de modelos; Chrome AI u Ollama son preferibles.</dd>
          </dl>
        </div>
      ),
    },
    {
      id: 'exportables',
      title: 'F. Exportables y evidencia',
      icon: <Download size={14} />,
      searchText: 'exportar pdf json csv hallazgos script notebook colab evidencia manifest reproducibilidad',
      content: (
        <div className="help-section-body">
          <div className="help-artifact-grid">
            <div><strong>PDF ejecutivo</strong><p>Resumen defendible para lectura humana: score, hallazgos, límites y recomendaciones.</p></div>
            <div><strong>JSON técnico</strong><p>Paquete completo para auditoría, reproducción y revisión posterior.</p></div>
            <div><strong>CSV de hallazgos</strong><p>Tabla filtrable con reglas activadas, severidad, columnas y muestras.</p></div>
            <div><strong>Script aprobado</strong><p>Python/Pandas revisado por humano. Debe ejecutarse fuera de AURA sobre una copia controlada.</p></div>
            <div><strong>Notebook Colab</strong><p>Plantilla externa para ejecutar el script cuando quieras un entorno guiado.</p></div>
            <div><strong>Manifest</strong><p>Declara qué evidencia es formal, preliminar, pendiente o limitada.</p></div>
          </div>
          <p className="help-decision">Buenas prácticas: conserva el CSV original, el reporte, el JSON y el script en la misma carpeta de evidencia.</p>
        </div>
      ),
    },
    {
      id: 'laboratorio',
      title: 'G. Laboratorio de modelos',
      icon: <FlaskConical size={14} />,
      searchText: 'laboratorio benchmark modelos configuraciones comparar corridas alucinaciones calibracion',
      content: (
        <div className="help-section-body">
          <p>El laboratorio no reemplaza la auditoría. Sirve para comparar cómo distintos modelos o configuraciones interpretan el mismo reporte determinista.</p>
          <ul className="help-checklist">
            <li>Ejecuta el laboratorio después de generar un perfil o reporte.</li>
            <li>Compara completitud, coherencia con hallazgos, uso de columnas reales y estabilidad.</li>
            <li>Desconfía de respuestas extensas que no citen evidencia del perfil.</li>
            <li>Usa los resultados para calibrar configuración, no para sobrescribir el motor determinista.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'script',
      title: 'H. Script y revisión humana',
      icon: <FileCode2 size={14} />,
      searchText: 'script pandas limpieza revision humana hitl simulacion copia delta salud aprobar rechazar',
      content: (
        <div className="help-section-body">
          <p>AURA puede generar una propuesta de limpieza, pero la aprobación es humana. El script debe ser claro, reproducible y proporcional al hallazgo.</p>
          <ul>
            <li>No apruebes eliminaciones de filas o columnas si no entiendes su impacto.</li>
            <li>Revisa columnas usadas por el script contra las columnas reales del CSV.</li>
            <li>Prefiere transformaciones reversibles o bien documentadas.</li>
            <li>Si el script corrige un síntoma pero destruye significado, recházalo o ajústalo fuera de AURA.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'errores',
      title: 'I. Errores frecuentes',
      icon: <AlertTriangle size={14} />,
      searchText: 'errores frecuentes ollama chrome ai webgpu cache api key diagnostico vacio script simulacion',
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>Ollama no responde</dt><dd>Abre Ollama, verifica <code>localhost:11434</code> y configura <code>OLLAMA_ORIGINS</code> si el navegador bloquea CORS.</dd>
            <dt>Chrome AI no disponible</dt><dd>Revisa versión de Chrome, flags de Built-in AI/Prompt API y disponibilidad del modelo en <code>chrome://on-device-internals</code>.</dd>
            <dt>API key inválida</dt><dd>Confirma proveedor, permisos, saldo y que la clave corresponda al servicio elegido.</dd>
            <dt>Diagnóstico vacío</dt><dd>Puede ser timeout, proveedor caído o modelo no cargado. Puedes continuar con evidencia determinista.</dd>
            <dt>Script con baja cobertura</dt><dd>No todos los hallazgos deben limpiarse automáticamente; algunos requieren decisión de dominio.</dd>
            <dt>Delta sin mejora</dt><dd>Revisa si el script atacó los hallazgos principales o si el score penaliza señales que requieren corrección manual.</dd>
            <dt>Exportación incompleta</dt><dd>Vuelve a la etapa correspondiente y confirma que el reporte, script o decisión humana ya existen.</dd>
          </dl>
        </div>
      ),
    },
    {
      id: 'faq',
      title: 'J. Preguntas frecuentes',
      icon: <HelpCircle size={14} />,
      searchText: 'preguntas frecuentes modifica archivo original confiar script que exportar proveedor conviene',
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>¿AURA modifica mi CSV?</dt><dd>No. Lee el archivo y simula sobre copias en memoria. Para aplicar cambios debes ejecutar el script aprobado fuera de AURA.</dd>
            <dt>¿Puedo usar AURA sin IA?</dt><dd>Sí. El perfil determinista y parte de la evidencia siguen siendo útiles aunque no ejecutes diagnóstico LLM.</dd>
            <dt>¿Qué exporto para entregar evidencia?</dt><dd>PDF para lectura, JSON para auditoría técnica, CSV de hallazgos para análisis y script aprobado si hubo propuesta de limpieza.</dd>
            <dt>¿Qué proveedor conviene?</dt><dd>Chrome AI si está disponible y quieres privacidad inmediata; Ollama si tienes modelos locales; Cloud si necesitas capacidad externa y aceptas enviar evidencia estructurada.</dd>
            <dt>¿Qué hago si el modelo se equivoca?</dt><dd>Prioriza el perfil determinista, registra la limitación y ajusta configuración o proveedor desde Laboratorio.</dd>
          </dl>
        </div>
      ),
    },
    {
      id: 'glosario',
      title: 'K. Glosario',
      icon: <FileText size={14} />,
      searchText: 'glosario dataset csv delimitador score hallazgo outlier iqr hitl manifest benchmark local first',
      content: (
        <div className="help-section-body">
          <dl className="help-glossary help-glossary--compact">
            <dt>Dataset</dt><dd>Conjunto de datos tabulares organizado en filas y columnas.</dd>
            <dt>CSV</dt><dd>Archivo de texto con valores separados por delimitador.</dd>
            <dt>Delimitador</dt><dd>Carácter que separa columnas: coma, punto y coma, tabulación u otro.</dd>
            <dt>Score</dt><dd>Puntuación de salud del dataset entre 0 y 100.</dd>
            <dt>Hallazgo</dt><dd>Regla o anomalía detectada por AURA.</dd>
            <dt>Outlier</dt><dd>Valor atípico respecto a la distribución de una columna.</dd>
            <dt>IQR</dt><dd>Rango intercuartílico usado para detectar valores atípicos.</dd>
            <dt>HITL</dt><dd>Human-in-the-Loop: revisión humana antes de decisiones sensibles.</dd>
            <dt>Manifest</dt><dd>Declaración de cobertura, límites y estado de la evidencia.</dd>
            <dt>Benchmark</dt><dd>Comparación controlada entre modelos o configuraciones.</dd>
            <dt>Delta</dt><dd>Cambio de salud estimado tras simular una limpieza.</dd>
            <dt>Local-first</dt><dd>Principio de procesamiento local antes de enviar datos o evidencia fuera del navegador.</dd>
          </dl>
        </div>
      ),
    },
  ];

  const query = searchQuery.trim().toLowerCase();
  const filteredSections = query
    ? sections.filter(section =>
        `${section.title} ${section.searchText}`.toLowerCase().includes(query)
      )
    : sections;

  return (
    <main className="help-center" data-testid="help-center">
      <div className="help-center-header">
        <button className="settings-back-btn" onClick={onClose}>
          <ArrowLeft size={14} /> Volver a auditoría
        </button>
        <div>
          <p className="sec-eye">centro de ayuda</p>
          <h1 className="sec-title">Ayuda de AURA</h1>
          <p className="help-center-subtitle">
            Guía operativa para auditar, interpretar, revisar y exportar evidencia sin perder el control del dato.
          </p>
        </div>
      </div>

      <div className="help-center-search" data-testid="help-search">
        <Search size={14} className="help-search-icon" />
        <input
          type="text"
          placeholder="Buscar: privacidad, score, script, laboratorio, exportación..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="help-search-input"
        />
      </div>

      <div className="help-center-body">
        {filteredSections.map(section => (
          <section key={section.id} className="help-center-section" data-testid={`help-section-${section.id}`}>
            <button
              className="help-center-section-header"
              onClick={() => toggleSection(section.id)}
              aria-expanded={expandedSections.has(section.id)}
            >
              <span className="help-center-section-icon">{section.icon}</span>
              <span className="help-center-section-title">{section.title}</span>
              <ChevronDown size={14} className={`help-center-section-chevron ${expandedSections.has(section.id) ? 'help-center-section-chevron--open' : ''}`} />
            </button>
            {expandedSections.has(section.id) && (
              <div className="help-center-section-content">
                {section.content}
              </div>
            )}
          </section>
        ))}

        {filteredSections.length === 0 && (
          <div className="help-center-empty">
            <Search size={24} />
            <p>No se encontraron resultados para "{searchQuery}".</p>
            <p>Prueba con "privacidad", "modelo", "score", "script" o "exportación".</p>
          </div>
        )}
      </div>
    </main>
  );
};

export default HelpCenter;
