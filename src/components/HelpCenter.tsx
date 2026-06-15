import React, { useState } from 'react';
import { ArrowLeft, Search, ChevronDown, Info, Shield, Zap, Cpu, Cloud, Lock, Globe, AlertTriangle, HelpCircle, FileText, ClipboardList, Brain, FileCode2, Download, FlaskConical } from 'lucide-react';

interface HelpCenterProps {
  onClose: () => void;
}

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: React.ReactNode;
}

const HelpCenter: React.FC<HelpCenterProps> = ({ onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['que-es-aura', 'flujo-completo']));

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
      id: 'que-es-aura',
      title: 'A. Qué es AURA',
      icon: <Info size={14} />,
      content: (
        <div className="help-section-body">
          <p>AURA es una herramienta de auditoría de calidad de datos que funciona completamente en el navegador. Su objetivo es ayudarte a entender el estado de un dataset CSV antes de usarlo para análisis, entrenamiento de modelos o toma de decisiones.</p>
          <p><strong>Qué hace AURA:</strong></p>
          <ul>
            <li>Analiza archivos CSV locales sin subirlos a ningún servidor.</li>
            <li>Detecta problemas de calidad: nulos, duplicados, outliers, formatos inconsistentes y anomalías lógicas.</li>
            <li>Genera un diagnóstico asistido por IA que interpreta las causas probables de los hallazgos.</li>
            <li>Propone un script de limpieza en Python (Pandas) que puedes revisar antes de ejecutar.</li>
            <li>Permite simular la limpieza sobre una copia del dataset para ver el efecto antes de aplicarlo.</li>
            <li>Genera evidencia trazable (JSON, PDF, CSV) que puedes compartir o auditar.</li>
          </ul>
          <p><strong>Qué no hace AURA:</strong></p>
          <ul>
            <li>No modifica tu archivo original sin tu acción explícita.</li>
            <li>No garantiza que el dataset quede perfecto; el juicio humano es necesario.</li>
            <li>No reemplaza una auditoría de datos profesional con contexto de negocio.</li>
            <li>No envía datos a servidores si usas modo Local.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'flujo-completo',
      title: 'B. Flujo completo',
      icon: <ClipboardList size={14} />,
      content: (
        <div className="help-section-body">
          <p>El flujo de trabajo de AURA tiene seis etapas. Aquí te explicamos cada una:</p>
          <ol className="help-flow-list">
            <li>
              <strong>1. Carga</strong>
              <p>Arrastra o selecciona un archivo CSV. AURA lo procesa en el navegador, detecta el delimitador y las columnas, y muestra una vista previa. El archivo <strong>no se sube a ningún servidor.</strong></p>
              <p className="help-decision">Tu decisión: ¿el archivo se cargó correctamente? ¿Las columnas y el delimitador son los esperados?</p>
            </li>
            <li>
              <strong>2. Perfil</strong>
              <p>AURA ejecuta su motor determinista de reglas: analiza cada columna (tipos, estadísticas, nulos, outliers, duplicados), detecta anomalías y calcula un score de calidad (0-100).</p>
              <p className="help-decision">Tu decisión: ¿los hallazgos coinciden con lo que sabes del dataset? ¿Hay columnas con muchos nulos o outliers que requieran atención?</p>
            </li>
            <li>
              <strong>3. Diagnóstico</strong>
              <p>AURA envía un paquete estructurado (no el archivo completo) al modelo de IA para que interprete las causas probables y proponga prioridades de limpieza. El resultado es una guía, no una verdad absoluta.</p>
              <p className="help-decision">Tu decisión: ¿las interpretaciones del modelo son razonables? ¿Hay algo que el modelo no consideró por falta de contexto de negocio?</p>
            </li>
            <li>
              <strong>4. Script</strong>
              <p>AURA genera un script de limpieza en Python (Pandas) basado en los hallazgos. Puedes revisarlo línea por línea. AURA valida que el script no use columnas inventadas ni operaciones destructivas no advertidas.</p>
              <p className="help-decision">Tu decisión: ¿el script hace lo que esperas? ¿Hay operaciones que prefieras ajustar manualmente? Si apruebas, puedes simularlo.</p>
            </li>
            <li>
              <strong>5. Revisión</strong>
              <p>Aquí decides si apruebas el script para simulación. AURA ejecuta el script sobre una copia del dataset y compara el antes y después (delta de salud). Si el score no mejora, te lo advertirá.</p>
              <p className="help-decision">Tu decisión: ¿el delta de salud es positivo? ¿La simulación produjo el resultado esperado? ¿Apruebas el script para uso externo?</p>
            </li>
            <li>
              <strong>6. Exportar</strong>
              <p>Descarga el reporte en PDF, el JSON técnico con toda la evidencia, los hallazgos en CSV, y el script aprobado en Python. Toda la evidencia es trazable y verificable.</p>
              <p className="help-decision">Tu decisión: ¿qué artefactos necesitas compartir? ¿La evidencia es suficiente para tu caso de uso?</p>
            </li>
            <li>
              <strong>7. Laboratorio</strong>
              <p>El laboratorio te permite probar diferentes modelos y configuraciones sobre el mismo dataset para comparar resultados. Es un espacio experimental para calibrar qué modelo funciona mejor para tus datos.</p>
              <p className="help-decision">Tu decisión: ¿qué modelo ofrece mejor balance entre velocidad, precisión y alucinaciones para tu dataset?</p>
            </li>
          </ol>
        </div>
      ),
    },
    {
      id: 'conceptos',
      title: 'C. Conceptos básicos',
      icon: <Brain size={14} />,
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>Dataset</dt><dd>Conjunto de datos organizado en filas y columnas, típicamente en formato CSV.</dd>
            <dt>CSV</dt><dd>Formato de archivo de texto con valores separados por comas (u otro delimitador). Es el formato de entrada de AURA.</dd>
            <dt>Delimitador</dt><dd>Carácter que separa las columnas en un CSV (coma, punto y coma, tabulación, etc.). AURA lo detecta automáticamente.</dd>
            <dt>Score</dt><dd>Puntuación de 0 a 100 que refleja la salud general del dataset. Mayor puntuación = mejor calidad.</dd>
            <dt>Hallazgo</dt><dd>Cada anomalía o regla activada que AURA detecta en el dataset.</dd>
            <dt>Crítico</dt><dd>Hallazgo que requiere atención inmediata. Puede afectar gravemente análisis posteriores.</dd>
            <dt>Advertencia</dt><dd>Hallazgo que requiere revisión pero no es bloqueante.</dd>
            <dt>Informativo</dt><dd>Sugerencia o dato complementario sin riesgo inmediato.</dd>
            <dt>Nulos</dt><dd>Valores vacíos o faltantes en una columna.</dd>
            <dt>Outliers</dt><dd>Valores atípicos que se alejan significativamente del resto de los datos. Se detectan con el método IQR (rango intercuartílico).</dd>
            <dt>IQR</dt><dd>Rango intercuartílico. Diferencia entre el tercer cuartil (Q3) y el primer cuartil (Q1). Se usa para detectar outliers.</dd>
            <dt>Columna fantasma</dt><dd>Columna que el modelo de IA menciona en el diagnóstico o script pero que no existe en el dataset real. Es un tipo de alucinación.</dd>
            <dt>Script Pandas</dt><dd>Código Python que usa la librería Pandas para limpiar y transformar datos. AURA lo genera automáticamente.</dd>
            <dt>HITL</dt><dd>Human-in-the-Loop. Significa que un humano revisa y aprueba las decisiones antes de ejecutarlas. AURA siempre requiere HITL para acciones destructivas.</dd>
            <dt>Simulación sobre copia</dt><dd>AURA ejecuta el script de limpieza sobre una copia temporal del dataset, sin modificar el original.</dd>
            <dt>Manifest</dt><dd>Documento que declara qué evidencia es formal, cuál es preliminar y qué limitaciones existen. Es parte del paquete de exportación.</dd>
            <dt>Evidencia formal</dt><dd>Resultado verificable y reproducible. Por ejemplo, el motor determinista produce evidencia formal.</dd>
            <dt>Evidencia preliminar</dt><dd>Resultado que requiere validación adicional. Por ejemplo, el diagnóstico del LLM es preliminar hasta que un humano lo revisa.</dd>
            <dt>Benchmark</dt><dd>Prueba controlada para comparar el rendimiento de diferentes modelos o configuraciones sobre el mismo dataset.</dd>
            <dt>Local-first</dt><dd>Filosofía de AURA: todo el procesamiento ocurre en el navegador del usuario. Los datos no salen del dispositivo a menos que uses modo Cloud.</dd>
          </dl>
        </div>
      ),
    },
    {
      id: 'configuracion',
      title: 'D. Configuración',
      icon: <SettingsIcon size={14} />,
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>Chrome AI / Gemini Nano</dt><dd>Modelo integrado en Chrome. Se ejecuta en el navegador sin enviar datos a terceros. Requiere Chrome 138+ con la API de Prompt API habilitada en chrome://flags. No funciona en Chrome móvil (iOS/Android). Requisitos: macOS 13+, GPU {'>'}4GB VRAM o CPU 16GB RAM 4 cores, ~22GB libres en perfil de Chrome.</dd>
            <dt>Ollama local</dt><dd>Servidor local de modelos LLM. Ejecuta la inferencia en tu máquina. Requiere instalar Ollama por separado. Conexión a http://localhost:11434. Ofrece máxima privacidad y variedad de modelos.</dd>
            <dt>Proveedor cloud</dt><dd>El modelo se ejecuta en servidores externos (Google, DeepSeek, Groq, etc.). Mayor velocidad y capacidad, pero envía un paquete estructurado al proveedor (no el archivo completo).</dd>
            <dt>WebGPU</dt><dd>Tecnología que permite ejecutar modelos de IA en la GPU del navegador. Necesaria para el modo Local. Disponible en Chrome/Edge 113+.</dd>
            <dt>Modelo</dt><dd>El modelo de lenguaje (LLM) que AURA usa para generar diagnósticos. En modo local son modelos cuantizados (4-bit) optimizados para navegador.</dd>
            <dt>API key</dt><dd>Clave de acceso para usar APIs cloud. Se almacena en localStorage del navegador y solo se envía al proveedor que elijas.</dd>
            <dt>Temperatura</dt><dd>Controla la variabilidad de las respuestas del modelo. 0.0 = más determinista. 1.0 = más creativo. Para auditoría se recomienda 0.1-0.2.</dd>
            <dt>Contrato del diagnóstico</dt><dd>Define cómo AURA le pide al modelo que estructure su respuesta. Control avanzado; los valores por defecto funcionan bien para la mayoría de casos.</dd>
            <dt>Caché del navegador</dt><dd>Los modelos locales se guardan en IndexedDB y Cache API del navegador. Puedes eliminarlos desde Configuración.</dd>
          </dl>
        </div>
      ),
    },
    {
      id: 'privacidad',
      title: 'E. Privacidad',
      icon: <Lock size={14} />,
      content: (
        <div className="help-section-body">
          <ul>
            <li><strong>Chrome AI / Gemini Nano:</strong> Se ejecuta completamente en el navegador. Ningún dato sale del dispositivo. Privacidad total.</li>
            <li><strong>Ollama local:</strong> La inferencia ocurre en tu máquina vía servidor local (localhost:11434). Los datos no salen de tu red local.</li>
            <li><strong>Modo Cloud:</strong> Se envía un paquete estructurado al proveedor (Google, DeepSeek, etc.) que contiene: nombres de columnas, estadísticas agregadas, hallazgos detectados y reglas activadas. <strong>No se envían filas de datos crudos ni el archivo CSV completo.</strong></li>
            <li><strong>Qué nunca debes subir:</strong> Datasets con información personal identificable, datos médicos, financieros o cualquier información protegida sin el permiso explícito correspondiente.</li>
            <li><strong>API keys:</strong> Se guardan en localStorage de tu navegador. No se comparten con terceros más allá del proveedor que elijas.</li>
          </ul>
        </div>
      ),
    },
    {
      id: 'errores',
      title: 'F. Errores frecuentes',
      icon: <AlertTriangle size={14} />,
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>Ollama no responde</dt><dd>Ollama no está accesible en localhost:11434. Solución: abre Ollama, verifica que esté corriendo, configura OLLAMA_ORIGINS si hay errores de CORS.</dd>
            <dt>Chrome AI / Gemini Nano no aparece o no está disponible</dt><dd>Si usas Chrome 138+ y ves "Proveedor no disponible", verifica los flags en <code>chrome://flags</code> buscando "Prompt API" o "Built-in AI". También revisa <code>chrome://on-device-internals</code> para ver modelos descargados. Desde DevTools ejecuta: <code>'LanguageModel' in globalThis</code> y <code>await LanguageModel.availability()</code>. Si no funciona, usa Ollama o Cloud como alternativa.</dd>
            <dt>WebLLM (experimental)</dt><dd>WebLLM fue movido a experimental por problemas de estabilidad con caché del navegador. Se recomienda usar Chrome AI u Ollama como alternativa local.</dd>
            <dt>Cache.add / network error</dt><dd>Error al descargar el modelo WebLLM. Solución: usa Chrome AI u Ollama en su lugar. WebLLM es experimental.</dd>
            <dt>WebGPU no disponible</dt><dd>Tu navegador no soporta WebGPU (necesario solo para WebLLM experimental). Usa Chrome AI u Ollama como alternativa local.</dd>
            <dt>API key inválida</dt><dd>La clave de API no es válida o no tiene saldo. Solución: verifica la key en el panel del proveedor. Algunos proveedores requieren configuración de billing.</dd>
            <dt>Modelo parcial</dt><dd>Una descarga anterior quedó incompleta. Solución: elimina el modelo desde Configuración y vuelve a descargarlo.</dd>
            <dt>Descarga lenta</dt><dd>Los modelos locales pueden pesar 0.1-5 GB. La primera descarga es la más lenta. Usa WiFi en lugar de datos móviles.</dd>
            <dt>Diagnóstico vacío</dt><dd>El modelo no generó respuesta. Puede deberse a timeout, error de red, o modelo no cargado. Puedes continuar con el script determinista sin diagnóstico LLM.</dd>
            <dt>Script sin cobertura</dt><dd>El script generado no cubre todos los hallazgos detectados. Esto puede ser normal: algunos hallazgos requieren decisión humana.</dd>
            <dt>Simulación sin mejora</dt><dd>El delta de salud es 0 o negativo. El script no mejoró el dataset. Revisa si las operaciones aplicadas son las correctas o si necesitas ajustar el script.</dd>
          </dl>
        </div>
      ),
    },
    {
      id: 'faq',
      title: 'G. Preguntas frecuentes',
      icon: <HelpCircle size={14} />,
      content: (
        <div className="help-section-body">
          <dl className="help-glossary">
            <dt>¿AURA limpia mi archivo automáticamente?</dt>
            <dd>No. AURA genera un script de limpieza que tú debes revisar y aprobar. El script se ejecuta sobre una copia temporal; el archivo original nunca se modifica automáticamente.</dd>
            <dt>¿El archivo original se modifica?</dt>
            <dd>No. AURA solo lee el archivo para analizarlo. La simulación de limpieza se hace sobre una copia en memoria. Para aplicar cambios debes descargar el script y ejecutarlo por tu cuenta.</dd>
            <dt>¿Puedo confiar en el script generado?</dt>
            <dd>El script es una propuesta basada en reglas deterministas. AURA valida que no tenga columnas inventadas ni operaciones destructivas no advertidas, pero tú debes revisarlo antes de ejecutarlo en datos reales.</dd>
            <dt>¿Qué significa que algo sea preliminar?</dt>
            <dd>Significa que el resultado necesita validación humana adicional antes de considerarse definitivo. Por ejemplo, el diagnóstico del LLM siempre es preliminar porque los modelos de IA pueden contener errores.</dd>
            <dt>¿Qué debo exportar?</dt>
            <dd>Depende de tu caso de uso. El PDF ejecutivo es bueno para compartir con stakeholders. El JSON técnico contiene toda la evidencia para auditoría. El CSV de hallazgos es útil para análisis posteriores. El script Python es lo que necesitas para limpiar los datos.</dd>
            <dt>¿Qué hago si no entiendo una métrica?</dt>
            <dd>Revisa la sección de Conceptos básicos en este mismo centro de ayuda. Si sigues con dudas, el glosario al final cubre la mayoría de términos.</dd>
            <dt>¿Cómo instalo y uso Ollama?</dt>
            <dd>Descarga Ollama desde <code>ollama.com</code>. Una vez instalado y abierto, escucha en <code>http://localhost:11434</code>. En AURA, selecciona "Ollama local" en el diagnóstico o en Configuración. Si el navegador bloquea la conexión por CORS, configura <code>OLLAMA_ORIGINS</code> para permitir el origen de AURA.</dd>
            <dt>¿Qué proveedor me conviene?</dt>
            <dd>Si tienes Chrome 127+ con Gemini Nano habilitado, usa Chrome AI (privacidad total). Si tienes Ollama instalado, es la opción local más robusta. Cloud es ideal si necesitas máxima capacidad y tienes API key.</dd>
          </dl>
        </div>
      ),
    },
    {
      id: 'glosario',
      title: 'H. Glosario',
      icon: <FileText size={14} />,
      content: (
        <div className="help-section-body">
          <dl className="help-glossary help-glossary--compact">
            <dt>AURA</dt><dd>Herramienta de auditoría de calidad de datos en navegador.</dd>
            <dt>CSV</dt><dd>Comma-Separated Values. Formato de archivo tabular.</dd>
            <dt>Dataset</dt><dd>Conjunto de datos tabulares (filas x columnas).</dd>
            <dt>Delimitador</dt><dd>Carácter separador de columnas en CSV.</dd>
            <dt>Score</dt><dd>Puntuación de calidad (0-100).</dd>
            <dt>Hallazgo</dt><dd>Anomalía detectada por el motor de reglas.</dd>
            <dt>Nulo</dt><dd>Valor vacío o faltante.</dd>
            <dt>Outlier</dt><dd>Valor atípico detectado por IQR.</dd>
            <dt>IQR</dt><dd>Rango intercuartílico.</dd>
            <dt>WebGPU</dt><dd>API de gráficos para inferencia local en navegador.</dd>
            <dt>WebLLM</dt><dd>Framework para ejecutar LLMs en navegador.</dd>
            <dt>MLC</dt><dd>Machine Learning Compilation. Formato de modelos WebLLM.</dd>
            <dt>LLM</dt><dd>Large Language Model. Modelo de lenguaje grande.</dd>
            <dt>API key</dt><dd>Clave de acceso para APIs cloud.</dd>
            <dt>Temperatura</dt><dd>Parámetro de variabilidad en generación de texto.</dd>
            <dt>Hallucination</dt><dd>Alucinación: información inventada por el modelo.</dd>
            <dt>HITL</dt><dd>Human-in-the-Loop. Revisión humana obligatoria.</dd>
            <dt>Pandas</dt><dd>Librería Python para manipulación de datos.</dd>
            <dt>Script</dt><dd>Código Python generado para limpiar datos.</dd>
            <dt>Benchmark</dt><dd>Prueba comparativa de modelos.</dd>
            <dt>Evidencia</dt><dd>Artefactos trazables del proceso de auditoría.</dd>
            <dt>Manifest</dt><dd>Declaración de cobertura y limitaciones de evidencia.</dd>
            <dt>Delta de salud</dt><dd>Diferencia de score antes y después de simular limpieza.</dd>
            <dt>Local-first</dt><dd>Procesamiento en navegador, sin envío de datos.</dd>
            <dt>CRITICAL</dt><dd>Severidad máxima de hallazgo. Requiere atención inmediata.</dd>
            <dt>WARNING</dt><dd>Severidad media. Requiere revisión.</dd>
            <dt>INFO</dt><dd>Severidad baja. Informativo.</dd>
          </dl>
        </div>
      ),
    },
  ];

  const filteredSections = searchQuery.trim()
    ? sections.filter(s => {
        const searchable = s.title + ' ' + (s.content as any)?.props?.children?.toString() || '';
        return searchable.toLowerCase().includes(searchQuery.toLowerCase());
      })
    : sections;

  return (
    <main className="help-center" data-testid="help-center">
      <div className="help-center-header">
        <button className="settings-back-btn" onClick={onClose}>
          <ArrowLeft size={14} /> Volver a auditoría
        </button>
        <div>
          <p className="sec-eye">centro de ayuda</p>
          <h1 className="sec-title">Centro de Ayuda de AURA</h1>
          <p className="help-center-subtitle">
            Todo lo que necesitas saber para auditar la calidad de tus datos con AURA.
          </p>
        </div>
      </div>

      <div className="help-center-search" data-testid="help-search">
        <Search size={14} className="help-search-icon" />
        <input
          type="text"
          placeholder="Buscar en la ayuda... (ej: privacidad, WebGPU, score)"
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
            <p>Prueba con otros términos como "privacidad", "modelo", "score" o "script".</p>
          </div>
        )}
      </div>
    </main>
  );
};

const SettingsIcon: React.FC<{ size?: number }> = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export default HelpCenter;
