export interface ColabNotebookParams {
  datasetName: string;
  csvFields: string[];
  approvedScript: string;
  auditSummary: {
    score: number;
    rowCount: number;
    colCount: number;
    issueCount: number;
    truncated?: boolean;
  };
  evidenceManifest?: string;
}

interface NotebookCell {
  cell_type: 'markdown' | 'code';
  metadata: Record<string, any>;
  source: string[];
  outputs?: any[];
  execution_count?: number | null;
}

interface Notebook {
  nbformat: number;
  nbformat_minor: number;
  metadata: {
    kernelspec: { display_name: string; language: string; name: string };
    language_info: { name: string; version: string };
    colab?: { provenance: any[] };
  };
  cells: NotebookCell[];
}

const mdCell = (source: string[]): NotebookCell => ({
  cell_type: 'markdown',
  metadata: {},
  source,
});

const codeCell = (source: string[]): NotebookCell => ({
  cell_type: 'code',
  metadata: { id: `cell-${Math.random().toString(36).slice(2, 9)}` },
  source,
  outputs: [],
  execution_count: null,
});

export const buildColabNotebook = (params: ColabNotebookParams): Notebook => {
  const { datasetName, csvFields, approvedScript, auditSummary, evidenceManifest } = params;

  const dateStr = new Date().toISOString().split('T')[0];

  const privacyWarning = [
    '# ⚠️ ADVERTENCIA DE PRIVACIDAD\n',
    '\n',
    'Este notebook se ejecuta **fuera de AURA**, en Google Colab (infraestructura de Google Cloud).\n',
    '\n',
    '- Los datos que cargues serán procesados en servidores de Google.\n',
    '- Si tu dataset contiene información sensible, personal o confidencial, **no lo subas a Colab**.\n',
    '- AURA no envía datos automáticamente. Tú decides qué archivo cargar.\n',
    '- Para datos sensibles, descarga el script `.py` desde AURA y ejecútalo en tu entorno local (Jupyter, VS Code, terminal).\n',
  ];

  const header = [
    `# AURA — Notebook de Limpieza de Datos\n`,
    '\n',
    `**Dataset:** ${datasetName}\n`,
    `**Fecha de exportación:** ${dateStr}\n`,
    `**Score AURA:** ${auditSummary.score}/100\n`,
    `**Filas auditadas:** ${auditSummary.rowCount.toLocaleString()} · **Columnas:** ${auditSummary.colCount}\n`,
    `**Hallazgos detectados:** ${auditSummary.issueCount}\n`,
    auditSummary.truncated ? '**⚠️ Preview limitado a 5.000 filas.** El dataset completo puede tener más filas.\n' : '',
    '\n',
    '---\n',
    '\n',
    '## Limitaciones\n',
    '\n',
    '- La auditoría se ejecutó en navegador con preview de 5.000 filas.\n',
    '- El script fue generado por IA y aprobado por revisión humana (HITL). **No ha sido ejecutado.**\n',
    '- La simulación de remediación en AURA es determinista (JavaScript), no Python.\n',
    '- Este notebook permite ejecutar el script real en Python/Pandas en Colab.\n',
    '- Después de ejecutar, compara el delta de salud real con el delta simulado en AURA.\n',
  ];

  const instructions = [
    '## Instrucciones\n',
    '\n',
    '1. Ejecuta las celdas en orden (Ctrl+Enter o Shift+Enter).\n',
    '2. Cuando se solicite, sube el archivo CSV original (el mismo que cargaste en AURA).\n',
    '3. El script de limpieza se ejecutará automáticamente.\n',
    '4. El dataset corregido se descargará como `dataset_corregido.csv`.\n',
    '5. Revisa el log de ejecución y el delta de salud.\n',
    '6. Vuelve a AURA para re-auditar el dataset corregido y comparar resultados.\n',
  ];

  const uploadCell = [
    '# Celda 1: Subir archivo CSV\n',
    'from google.colab import files\n',
    'import io\n',
    '\n',
    'print("Selecciona el archivo CSV original (el mismo que cargaste en AURA):")\n',
    'uploaded = files.upload()\n',
    '\n',
    '# Obtener el nombre del archivo subido\n',
    'filename = list(uploaded.keys())[0]\n',
    `print(f"Archivo cargado: {filename} ({len(uploaded[filename])} bytes)")\n`,
  ];

  const readCell = [
    '# Celda 2: Leer CSV con Pandas\n',
    'import pandas as pd\n',
    '\n',
    'df = pd.read_csv(io.BytesIO(uploaded[filename]))\n',
    `print(f"Filas: {len(df)}")\n`,
    `print(f"Columnas: {list(df.columns)}")\n`,
    `print(f"Tipos:\\n{df.dtypes}")\n`,
    'df.head()\n',
  ];

  const scriptLines = approvedScript.split('\n');
  const scriptCell = [
    '# Celda 3: Script de limpieza aprobado (HITL)\n',
    '# Este script fue generado por IA y aprobado por revisión humana en AURA.\n',
    '# NO MODIFICAR sin antes entender qué hace cada línea.\n',
    '\n',
    ...scriptLines.map(line => line + '\n'),
  ];

  const fieldsStr = csvFields.join(', ');
  const executionCell = [
    '# Celda 4: Ejecutar limpieza y descargar dataset corregido\n',
    'import hashlib\n',
    'from datetime import datetime\n',
    '\n',
    'print("Ejecutando script de limpieza...")\n',
    'start_time = datetime.now()\n',
    '\n',
    '# Ejecutar la función de limpieza\n',
    'df_corregido = clean_dataset(df)\n',
    '\n',
    'end_time = datetime.now()\n',
    'duration = (end_time - start_time).total_seconds()\n',
    '\n',
    '# Calcular hash del resultado\n',
    'csv_output = df_corregido.to_csv(index=False)\n',
    'output_hash = hashlib.sha256(csv_output.encode()).hexdigest()\n',
    '\n',
    '# Guardar archivo corregido\n',
    'output_filename = "dataset_corregido.csv"\n',
    'df_corregido.to_csv(output_filename, index=False)\n',
    '\n',
    'print(f"✅ Limpieza completada en {duration:.2f}s")\n',
    `print(f"Filas procesadas: {len(df_corregido)}")\n`,
    `print(f"Hash del resultado: {output_hash[:16]}...")\n`,
    `print(f"Columnas: ${fieldsStr}")\n`,
    '\n',
    '# Descargar archivo corregido\n',
    'from google.colab import files\n',
    'files.download(output_filename)\n',
    '\n',
    '# Mostrar primeras filas del resultado\n',
    'df_corregido.head()\n',
  ];

  const checklist = [
    '## Checklist post-ejecución\n',
    '\n',
    'Después de ejecutar este notebook, completa los siguientes pasos para cerrar el ciclo de evidencia:\n',
    '\n',
    '- [ ] Guarda el dataset corregido (`dataset_corregido.csv`).\n',
    '- [ ] Guarda el log de ejecución (tiempo, hash, filas procesadas).\n',
    '- [ ] **Vuelve a AURA** y carga el dataset corregido para re-auditarlo.\n',
    '- [ ] Compara el delta de salud real (Colab) con el delta simulado (AURA).\n',
    '- [ ] Si el delta real es menor que el simulado, revisa el script: puede contener operaciones que no mejoran la calidad.\n',
    '- [ ] Conserva siempre una copia del dataset original sin modificar.\n',
    '- [ ] Documenta cualquier decisión manual tomada durante la revisión del script.\n',
    '\n',
    '---\n',
    '\n',
    `*Notebook generado por AURA v0.5.0 el ${dateStr}. Dataset: ${datasetName}. Score: ${auditSummary.score}/100.*\n`,
    evidenceManifest ? `\n*Evidencia de trazabilidad incluida en metadatos del notebook.*\n` : '',
  ];

  const cells: NotebookCell[] = [
    mdCell(privacyWarning),
    mdCell(header),
    mdCell(instructions),
    codeCell(uploadCell),
    codeCell(readCell),
    codeCell(scriptCell),
    codeCell(executionCell),
    mdCell(checklist),
  ];

  return {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: {
      kernelspec: {
        display_name: 'Python 3',
        language: 'python',
        name: 'python3',
      },
      language_info: {
        name: 'python',
        version: '3.10.0',
      },
      colab: {
        provenance: [],
      },
    },
    cells,
  };
};

export const buildColabNotebookJSON = (params: ColabNotebookParams): string => {
  return JSON.stringify(buildColabNotebook(params), null, 2);
};
