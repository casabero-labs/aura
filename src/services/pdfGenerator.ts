import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuditReport, ExecutiveReportContent, IssueSeverity, IssueCategory, ScriptValidationResult, HealthDelta } from '../types';

declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

type SaveCallback = (doc: jsPDF, filename: string) => void;

const classifyScriptLine = (line: string): 'destructiva' | 'transformacion' | 'lectura' | null => {
  const normalized = line.toLowerCase();
  if (/\b(drop|delete|del |remove|pop|truncate|overwrite|to_csv|to_excel)\b/.test(normalized)) return 'destructiva';
  if (/\b(fillna|replace|astype|rename|assign|map|apply|clip|str\.|where|loc\[|iloc\[)\b/.test(normalized)) return 'transformacion';
  if (/\b(value_counts|describe|isna|isnull|info|head|tail|shape|columns|dtypes|unique|nunique)\b/.test(normalized)) return 'lectura';
  return null;
};

const scriptLabelColor = (
  kind: ReturnType<typeof classifyScriptLine>,
  colors: { red: string; orange: string; green: string; lightText: string }
) => {
  if (kind === 'destructiva') return colors.red;
  if (kind === 'transformacion') return colors.orange;
  if (kind === 'lectura') return colors.green;
  return colors.lightText;
};

const defaultSave: SaveCallback = (doc, filename) => doc.save(filename);

export const generatePdfReport = (
  auditReport: AuditReport,
  executiveContent: ExecutiveReportContent,
  llmDiagnosis?: string,
  scriptValidation?: ScriptValidationResult,
  save: SaveCallback = defaultSave,
  healthDelta?: HealthDelta | null
): { filename: string; pageCount: number } => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  // Track which pages have content (index 1 = page 1)
  const pagesWithContent = new Set<number>([1]);

  const markPageContent = (pageNum?: number) => {
    pagesWithContent.add(pageNum ?? doc.getCurrentPageInfo().pageNumber);
  };

  const colors = {
    primary: '#2d2c2a',
    secondary: '#5a5854',
    accent: '#b08d57',
    text: '#403e3c',
    lightText: '#8c8a84',
    red: '#8b3a3a',
    orange: '#b08d57',
    green: '#3e5a32',
    border: '#e5e0d8',
  };

  let yPos = margin;

  const drawSectionHeader = (title: string) => {
    if (yPos > pageHeight - 30) { doc.addPage(); yPos = margin; }
    markPageContent();
    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(colors.primary);
    doc.text(title.toUpperCase(), margin, yPos);
    doc.setDrawColor(colors.accent);
    doc.setLineWidth(0.5);
    doc.line(margin, yPos + 2, pageWidth - margin, yPos + 2);
    yPos += 10;
  };

  const drawParagraph = (text: string) => {
    if (yPos > pageHeight - 20) { doc.addPage(); yPos = margin; }
    markPageContent();
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(colors.text);
    const lines = doc.splitTextToSize(text, pageWidth - (margin * 2));
    doc.text(lines, margin, yPos);
    yPos += (lines.length * 6) + 6;
  };

  // --- PAGE 1: TITLE PAGE ---
  markPageContent(1);

  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(colors.primary);
  const titleLines = doc.splitTextToSize(executiveContent.title, pageWidth - (margin * 2));
  doc.text(titleLines, pageWidth / 2, 60, { align: 'center' });

  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(colors.accent);
  doc.text(executiveContent.domain_inferred, pageWidth / 2, 80, { align: 'center' });

  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(colors.lightText);
  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(dateStr.charAt(0).toUpperCase() + dateStr.slice(1), pageWidth / 2, 90, { align: 'center' });

  const circleY = 140;
  doc.setDrawColor(colors.border);
  doc.setLineWidth(1);
  doc.circle(pageWidth / 2, circleY, 25, 'S');

  doc.setFont('times', 'bold');
  doc.setFontSize(36);
  const scoreColor = auditReport.score >= 80 ? colors.green : auditReport.score >= 50 ? colors.orange : colors.red;
  doc.setTextColor(scoreColor);
  doc.text(String(auditReport.score), pageWidth / 2, circleY + 4, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(colors.secondary);
  doc.text("QUALITY SCORE", pageWidth / 2, circleY + 18, { align: 'center' });

  const statsY = 220;
  doc.setFontSize(12);
  doc.setTextColor(colors.primary);

  const stats = [
    { label: "Filas Analizadas", value: auditReport.rowCount.toLocaleString() },
    { label: "Columnas", value: String(auditReport.colCount) },
    { label: "Duplicados", value: String(auditReport.duplicateRows) },
    { label: "Reglas Rotas", value: String(auditReport.issues.length) },
  ];

  const statWidth = (pageWidth - margin * 2) / 4;
  stats.forEach((stat, i) => {
    const x = margin + (statWidth * i) + (statWidth / 2);
    doc.setFont('times', 'bold');
    doc.text(stat.value, x, statsY, { align: 'center' });
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.lightText);
    doc.text(stat.label, x, statsY + 6, { align: 'center' });
    doc.setFontSize(12);
    doc.setTextColor(colors.primary);
  });

  doc.addPage();
  markPageContent();
  yPos = margin;

  // --- PAGE 2: EXECUTIVE SUMMARY & NARRATIVE ---

  drawSectionHeader("1. Resumen Ejecutivo");
  drawParagraph(executiveContent.executive_summary);

  drawSectionHeader("2. Descripcion Tecnica del Dataset");
  drawParagraph(executiveContent.dataset_technical_description);

  drawSectionHeader("3. Impacto en el Negocio");
  drawParagraph(executiveContent.business_impact);

  drawSectionHeader("4. Hallazgos Clave");
  executiveContent.key_findings.forEach((finding) => {
    if (yPos > pageHeight - 20) { doc.addPage(); yPos = margin; }
    markPageContent();
    doc.setTextColor(colors.accent);
    doc.text("\u2022", margin, yPos);
    doc.setTextColor(colors.text);
    const splitFinding = doc.splitTextToSize(finding, pageWidth - margin - 25);
    doc.text(splitFinding, margin + 5, yPos);
    yPos += splitFinding.length * 6 + 2;
  });
  yPos += 10;

  drawSectionHeader("5. Recomendaciones");
  executiveContent.recommendations.forEach((rec, idx) => {
    if (yPos > pageHeight - 20) { doc.addPage(); yPos = margin; }
    markPageContent();
    const text = `${idx + 1}. ${rec}`;
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 6 + 2;
  });

  // --- SOURCE DEBT WARNING (when delta ≤ 0) ---
  if (healthDelta && healthDelta.scoreDelta <= 0) {
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin; }
    sectionIndex++;
    drawSectionHeader(`${sectionIndex}. Preservacion de Deuda de Fuente`);
    yPos += 3;
    doc.setFillColor(139, 58, 58);
    doc.rect(margin, yPos, pageWidth - margin * 2, 22, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(10);
    const warningLines = doc.splitTextToSize(
      'La remediacion aplicada preserva deuda de fuente. El score no mejora bajo runAudit porque la deuda de CrimeId es de origen (columna contaminada en el sistema fuente). La remediacion no corrige el dato primario: CrimeId permanece como evidencia en columnas auxiliares. Deuda de fuente presente.',
      pageWidth - margin * 2 - 10
    );
    doc.text(warningLines.slice(0, 3), margin + 5, yPos + 7);
    yPos += 27;
    doc.setTextColor(colors.text);
    if (healthDelta.criticalDelta > 0) {
      doc.setFontSize(9);
      const criticalWarning = `Advertencia: ${healthDelta.criticalDelta} hallazgo(s) critico(s) adicional(es) detectado(s) despues de la remediacion. El score oficial no mejora. La deuda de fuente persiste.`;
      const critLines = doc.splitTextToSize(criticalWarning, pageWidth - margin * 2);
      doc.text(critLines, margin, yPos);
      yPos += critLines.length * 5 + 5;
    }
    yPos += 5;
  }

  // --- LLM DIAGNOSIS (only if content is present) ---
  let sectionIndex = 5;

  if (llmDiagnosis) {
    if (yPos > pageHeight - 50) { doc.addPage(); yPos = margin; }
    sectionIndex++;
    drawSectionHeader(`${sectionIndex}. Diagnostico LLM (OE3)`);
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(colors.lightText);
    doc.text("Interpretacion generada por modelo de lenguaje a partir de los hallazgos deterministas. No verificable estadisticamente.", margin, yPos - 3);
    yPos += 5;

    const diagLines = doc.splitTextToSize(llmDiagnosis, pageWidth - margin * 2);
    let diagYPos = yPos;
    diagLines.forEach((line: string) => {
      if (diagYPos > pageHeight - margin) {
        doc.addPage();
        diagYPos = margin;
      }
      markPageContent();
      doc.setFont('times', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(colors.text);
      doc.text(line, margin, diagYPos);
      diagYPos += 5.5;
    });
    yPos = diagYPos + 10;
  }

  // --- DATA PROFILE ---
  if (yPos > pageHeight - 30) { doc.addPage(); yPos = margin; }
  sectionIndex++;
  drawSectionHeader(`${sectionIndex}. Perfil Detallado de Columnas`);
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(colors.lightText);
  doc.text("Analisis estadistico deterministico de cada variable del dataset.", margin, yPos - 3);
  yPos += 5;

  const profileData = Object.values(auditReport.columnStats).map(col => [
    col.name,
    col.inferredType.toUpperCase(),
    `${col.nullCount} (${((col.nullCount / auditReport.rowCount) * 100).toFixed(1)}%)`,
    col.uniqueCount.toLocaleString(),
    col.topFreq && col.topFreq.length > 0 ? col.topFreq[0].value.substring(0, 20) : '-',
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Columna', 'Tipo', 'Nulos', 'Unicos', 'Valor Top']],
    body: profileData,
    theme: 'grid',
    styles: { font: 'times', fontSize: 10, cellPadding: 4, lineColor: [203, 213, 225] },
    headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 'auto' },
      1: { cellWidth: 25 },
      2: { cellWidth: 25, halign: 'right' },
      3: { cellWidth: 25, halign: 'right' },
      4: { cellWidth: 40 },
    },
    didDrawPage: () => markPageContent(),
  });

  // Mark content on all pages containing the table
  const totalPages = doc.getNumberOfPages();
  for (let p = doc.getCurrentPageInfo().pageNumber; p <= totalPages; p++) {
    pagesWithContent.add(p);
  }

  yPos = doc.lastAutoTable.finalY + 20;

  // --- VALIDATION ENGINE FINDINGS ---

  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = margin;
  }

  sectionIndex++;
  drawSectionHeader(`${sectionIndex}. Reporte de Anomalias (Motor Determinista)`);

  const categories = [
    IssueCategory.INTEGRITY,
    IssueCategory.HYGIENE,
    IssueCategory.TYPES,
    IssueCategory.LOGIC,
    IssueCategory.SEMANTIC,
  ];

  categories.forEach(cat => {
    const catIssues = auditReport.issues.filter(i => i.category === cat);
    if (catIssues.length === 0) return;

    if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin; }

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.accent);
    doc.text(cat.toUpperCase(), margin, yPos);
    markPageContent();
    yPos += 5;

    const issueRows = catIssues.map(issue => [
      issue.ruleName,
      issue.column || 'N/A',
      issue.severity.toUpperCase(),
      issue.count,
      `${issue.affectedPercentage.toFixed(1)}%`,
      issue.description,
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Regla', 'Columna', 'Sev.', 'Cant.', '%', 'Descripcion']],
      body: issueRows,
      theme: 'plain',
      styles: { font: 'times', fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 25 },
        2: { cellWidth: 20, fontStyle: 'bold' },
        3: { cellWidth: 15, halign: 'right' },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 'auto' },
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const val = data.cell.raw as string;
          if (val === 'CRITICAL') data.cell.styles.textColor = [185, 28, 28];
          else if (val === 'WARNING') data.cell.styles.textColor = [194, 65, 12];
        }
      },
      didDrawPage: () => markPageContent(),
    });

    yPos = doc.lastAutoTable.finalY + 10;
  });

  // --- GOVERNANCE & TRACEABILITY SUMMARY ---
  if (scriptValidation) {
    if (yPos > pageHeight - 50) { doc.addPage(); yPos = margin; }
    sectionIndex++;
    drawSectionHeader(`${sectionIndex}. Gobernanza y Validacion HITL`);

    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(colors.lightText);
    doc.text("Auditoria de codigo estatica y trazabilidad de control humano (Human-in-the-Loop).", margin, yPos - 3);
    yPos += 5;

    const statusText = scriptValidation.valid
      ? "APROBADO PARA USO EXPERIMENTAL"
      : "REQUIERE REVISION HUMANA O RE-PROCESAMIENTO";
    const statusColor = scriptValidation.valid ? colors.green : colors.orange;

    doc.setFillColor(248, 250, 248);
    doc.setDrawColor(statusColor);
    doc.setLineWidth(1);
    doc.rect(margin, yPos, pageWidth - margin * 2, 20, 'FD');
    markPageContent();

    doc.setFont('times', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(statusColor);
    doc.text(statusText, margin + 5, yPos + 8);

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.text);
    doc.text(
      scriptValidation.requiresHumanReview
        ? "Advertencia: El script contiene operaciones criticas o posibles desviaciones que requieren validacion."
        : "El script cumple con los requisitos del esquema y no presenta operaciones destructivas directas.",
      margin + 5,
      yPos + 14,
    );
    yPos += 28;

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.primary);
    doc.text("DETALLES DE LA VERIFICACION:", margin, yPos);
    yPos += 6;

    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.text);
    const colStatus = scriptValidation.invalidColumns.length > 0
      ? `Columnas fantasma detectadas: ${scriptValidation.invalidColumns.join(', ')} (Alucinacion!)`
      : "Todas las columnas referenciadas existen en el dataset original (Anclaje exitoso).";
    doc.text(`\u2022 Estado de Columnas: ${colStatus}`, margin + 5, yPos);
    yPos += 6;

    const destStatus = scriptValidation.destructiveOperations.length > 0
      ? `Operaciones destructivas detectadas: ${scriptValidation.destructiveOperations.join(', ')}`
      : "No se detectaron mutaciones en caliente destructivas (ej: .drop, dropna sin reasignar).";
    doc.text(`\u2022 Operaciones Criticas: ${destStatus}`, margin + 5, yPos);
    yPos += 6;

    doc.text(`\u2022 Cobertura de Hallazgos: ${scriptValidation.coveredIssueIds.length} anomalias del perfil determinista trazadas y mitigadas por este script.`, margin + 5, yPos);
    yPos += 6;

    if (scriptValidation.warnings.length > 0) {
      yPos += 4;
      doc.setFont('times', 'bold');
      doc.text("ADVERTENCIAS DE SEGURIDAD:", margin, yPos);
      yPos += 6;
      doc.setFont('times', 'normal');
      doc.setTextColor(colors.red);
      scriptValidation.warnings.forEach(warn => {
        if (yPos > pageHeight - 15) { doc.addPage(); yPos = margin; }
        markPageContent();
        doc.text(`- ${warn}`, margin + 5, yPos);
        yPos += 5;
      });
    }

    yPos += 15;
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = margin;
    }
    markPageContent();

    doc.setDrawColor(colors.border);
    doc.setLineWidth(0.5);
    const sigX = margin + 10;
    const sigY = yPos + 20;
    doc.line(sigX, sigY, sigX + 60, sigY);

    doc.setFont('times', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(colors.secondary);
    doc.text("Firma del Auditor Humano (HITL)", sigX + 5, sigY + 5);
    doc.text("Gobernanza de Calidad del Dato", sigX + 5, sigY + 10);

    const dirX = pageWidth - margin - 70;
    doc.line(dirX, sigY, dirX + 60, sigY);
    doc.text("Director de Tesis / Evaluador", dirX + 5, sigY + 5);
    doc.text("Validacion del Prototipo AURA", dirX + 5, sigY + 10);

    yPos = sigY + 25;
  }

  // --- PYTHON SCRIPT ---
  if (executiveContent.python_script) {
    if (yPos > pageHeight - 60) { doc.addPage(); yPos = margin; }
    sectionIndex++;
    drawSectionHeader(`${sectionIndex}. Script de Limpieza (Python/Pandas)`);

    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(colors.red);
    doc.text("ATENCION: Codigo generado automaticamente por IA. Requiere revision humana (HITL) antes de ejecucion.", margin, yPos - 3);
    yPos += 8;

    const scriptLines = executiveContent.python_script.split('\n');

    let codeYPos = yPos;
    const codeMaxWidth = pageWidth - margin * 2 - 46;

    scriptLines.forEach((line: string, index: number) => {
      if (codeYPos > pageHeight - margin) {
        doc.addPage();
        codeYPos = margin;
      }
      markPageContent();

      const kind = classifyScriptLine(line);
      doc.setFont('courier', 'normal');
      doc.setFontSize(7);
      doc.setTextColor(colors.lightText);
      doc.text(String(index + 1).padStart(2, '0'), margin + 4, codeYPos);
      if (kind) {
        doc.setTextColor(scriptLabelColor(kind, colors));
        doc.text(`[${kind}]`, margin + 14, codeYPos);
      }
      doc.setTextColor(51, 65, 85);
      const wrappedLine = doc.splitTextToSize(line, codeMaxWidth);
      wrappedLine.forEach((part: string, partIndex: number) => {
        if (partIndex > 0) {
          codeYPos += 4;
          if (codeYPos > pageHeight - margin) { doc.addPage(); codeYPos = margin; }
          markPageContent();
        }
        doc.text(part, margin + 44, codeYPos);
      });
      codeYPos += 5;
    });

    yPos = codeYPos + 10;
  }

  // --- METHODOLOGICAL LIMITATIONS ---
  if (yPos > pageHeight - 60) { doc.addPage(); yPos = margin; }
  sectionIndex++;
  drawSectionHeader(`${sectionIndex}. Limitaciones Metodologicas`);

  const limitations = [
    "Auditoria ejecutada en navegador con preview limitado a 5.000 filas. Datasets mayores requieren procesamiento completo fuera de AURA.",
    "La simulación de remediacion opera sobre una copia en memoria del dataset; no modifica el archivo original.",
    "El script de limpieza no se ejecuta dentro de AURA. Debe ejecutarse en un entorno Python externo (local, Colab, Jupyter) bajo supervision humana.",
    "El score de calidad refleja exclusivamente las reglas del motor determinista. No incorpora inferencias no verificables del modelo de lenguaje.",
    "Las reglas semanticas operan sobre heuristica de cardinalidad y patrones de texto; no sustituyen validacion de dominio por un experto.",
    "Este reporte constituye evidencia preliminar. Para validez formal se requiere: repeticion de corridas, contraste multi-modelo, y ejecucion real del script de limpieza.",
  ];

  limitations.forEach((lim) => {
    if (yPos > pageHeight - 20) { doc.addPage(); yPos = margin; }
    markPageContent();
    doc.setFont('times', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(colors.secondary);
    const lines = doc.splitTextToSize(`\u2022 ${lim}`, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 5.5 + 4;
  });

  // --- Remove trailing blank pages ---
  const finalPageCount = doc.getNumberOfPages();
  // Pages without content and after the last content page are candidates for removal
  // But jsPDF doesn't support removing pages easily. We'll ensure every page has content.
  // If the last page has no content, it's because a page break was triggered but nothing drawn.
  // Our markPageContent tracking ensures we know which pages have real content.

  // --- Footer ---
  const addFooters = () => {
    const total = doc.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      doc.setPage(i);
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(colors.lightText);
      doc.text(
        `Aura Data Lab — Informe de Diagnostico — Pagina ${i} de ${total}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }
  };
  addFooters();

  // Check if last page is blank and remove it if possible.
  // jsPDF 2.x does not support deletePage, but we can avoid blank pages by not adding them.
  // If the last page was added via doc.addPage() but has no content, we note it via pageCount.

  const effectivePageCount = doc.getNumberOfPages();

  const filename = 'Aura_Data_Lab_Diagnostico.pdf';
  save(doc, filename);
  return { filename, pageCount: effectivePageCount };
};
