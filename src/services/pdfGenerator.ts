import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AuditReport, ExecutiveReportContent, IssueSeverity, IssueCategory } from '../types';

// Extend jsPDF type definition for autotable
declare module 'jspdf' {
  interface jsPDF {
    lastAutoTable: {
      finalY: number;
    };
  }
}

export const generatePdfReport = (auditReport: AuditReport, executiveContent: ExecutiveReportContent) => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 20;

  // -- Styles (Aura Data Lab Look) --
  const colors = {
    primary: '#2d2c2a',   // Graphite
    secondary: '#5a5854', // Muted Graphite
    accent: '#b08d57',    // Gold/Tan Accent
    text: '#403e3c',      // Dark Gray
    lightText: '#8c8a84', // Stone Gray
    red: '#8b3a3a',       // Deep Crimson
    orange: '#b08d57',    // Ochre
    green: '#3e5a32',     // Forest Green
    border: '#e5e0d8'     // Paper Border
  };

  let yPos = margin;

  // --- Helper: Footer with Page Numbers ---
  const addFooters = () => {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('times', 'italic');
      doc.setFontSize(8);
      doc.setTextColor(colors.lightText);
      doc.text(`Aura Data Lab - Informe de Diagnóstico Inteligente - Página ${i} de ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
    }
  };

  // --- PAGE 1: TITLE PAGE ---

  // Title (Centered, Multi-line support)
  doc.setFont('times', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(colors.primary);
  const titleLines = doc.splitTextToSize(executiveContent.title, pageWidth - (margin * 2));
  doc.text(titleLines, pageWidth / 2, 60, { align: 'center' });

  // Subtitle / Domain
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(colors.accent);
  doc.text(executiveContent.domain_inferred, pageWidth / 2, 80, { align: 'center' });

  // Date
  doc.setFont('times', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(colors.lightText);
  const dateStr = new Date().toLocaleDateString('es-ES', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(dateStr.charAt(0).toUpperCase() + dateStr.slice(1), pageWidth / 2, 90, { align: 'center' });

  // Visual Score Circle (Centered)
  const circleY = 140;
  doc.setDrawColor(colors.border);
  doc.setLineWidth(1);
  doc.circle(pageWidth / 2, circleY, 25, 'S');

  // Score Text
  doc.setFont('times', 'bold');
  doc.setFontSize(36);
  const scoreColor = auditReport.score >= 80 ? colors.green : auditReport.score >= 50 ? colors.orange : colors.red;
  doc.setTextColor(scoreColor);
  doc.text(String(auditReport.score), pageWidth / 2, circleY + 4, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(colors.secondary);
  doc.text("QUALITY SCORE", pageWidth / 2, circleY + 18, { align: 'center' });

  // Bottom Summary Stats
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
  yPos = margin;

  // --- PAGE 2: EXECUTIVE SUMMARY & NARRATIVE ---

  const drawSectionHeader = (title: string) => {
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
    doc.setFont('times', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(colors.text);
    const lines = doc.splitTextToSize(text, pageWidth - (margin * 2));
    doc.text(lines, margin, yPos);
    yPos += (lines.length * 6) + 6;
  };

  drawSectionHeader("1. Resumen Ejecutivo");
  drawParagraph(executiveContent.executive_summary);

  drawSectionHeader("2. Descripción Técnica del Dataset");
  drawParagraph(executiveContent.dataset_technical_description);

  drawSectionHeader("3. Impacto en el Negocio");
  drawParagraph(executiveContent.business_impact);

  drawSectionHeader("4. Hallazgos Clave");
  executiveContent.key_findings.forEach((finding) => {
    doc.setTextColor(colors.accent);
    doc.text("•", margin, yPos);
    doc.setTextColor(colors.text);
    const splitFinding = doc.splitTextToSize(finding, pageWidth - margin - 25);
    doc.text(splitFinding, margin + 5, yPos);
    yPos += splitFinding.length * 6 + 2;
  });
  yPos += 10;

  drawSectionHeader("5. Recomendaciones");
  executiveContent.recommendations.forEach((rec, idx) => {
    const text = `${idx + 1}. ${rec}`;
    const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
    doc.text(lines, margin, yPos);
    yPos += lines.length * 6 + 2;
  });

  doc.addPage();
  yPos = margin;

  // --- PAGE 3: DATA PROFILE (The Deterministic Facts) ---

  drawSectionHeader("6. Perfil Detallado de Columnas");
  doc.setFont('times', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(colors.lightText);
  doc.text("Análisis estadístico determinístico de cada variable del dataset.", margin, yPos - 3);
  yPos += 5;

  // Prepare table data
  const profileData = Object.values(auditReport.columnStats).map(col => [
    col.name,
    col.inferredType.toUpperCase(),
    `${col.nullCount} (${((col.nullCount / auditReport.rowCount) * 100).toFixed(1)}%)`,
    col.uniqueCount.toLocaleString(),
    col.topFreq && col.topFreq.length > 0 ? col.topFreq[0].value.substring(0, 20) : '-'
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Columna', 'Tipo', 'Nulos', 'Únicos', 'Valor Top']],
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
      4: { cellWidth: 40 }
    }
  });

  yPos = doc.lastAutoTable.finalY + 20;

  // --- PAGE X: VALIDATION ENGINE FINDINGS ---

  // Check if we need a new page for the header
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = margin;
  }

  drawSectionHeader("7. Reporte de Anomalías (Motor de 22+ Reglas)");

  // Group issues by category for better readability
  const categories = [
    IssueCategory.INTEGRITY,
    IssueCategory.HYGIENE,
    IssueCategory.TYPES,
    IssueCategory.LOGIC,
    IssueCategory.SEMANTIC
  ];

  categories.forEach(cat => {
    const catIssues = auditReport.issues.filter(i => i.category === cat);
    if (catIssues.length === 0) return;

    // Sub-header for Category
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin; }

    doc.setFont('times', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(colors.accent);
    doc.text(cat.toUpperCase(), margin, yPos);
    yPos += 5;

    const issueRows = catIssues.map(issue => [
      issue.ruleName,
      issue.column || 'N/A',
      issue.severity.toUpperCase(),
      issue.count,
      `${issue.affectedPercentage.toFixed(1)}%`,
      issue.description
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Regla', 'Columna', 'Sev.', 'Cant.', '%', 'Descripción']],
      body: issueRows,
      theme: 'plain', // Cleaner look for sub-tables
      styles: { font: 'times', fontSize: 9, cellPadding: 2, overflow: 'linebreak' },
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85], fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 25 },
        2: { cellWidth: 20, fontStyle: 'bold' },
        3: { cellWidth: 15, halign: 'right' },
        4: { cellWidth: 15, halign: 'right' },
        5: { cellWidth: 'auto' }
      },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 2) {
          const val = data.cell.raw as string;
          if (val === 'CRITICAL') data.cell.styles.textColor = [185, 28, 28];
          else if (val === 'WARNING') data.cell.styles.textColor = [194, 65, 12];
        }
      }
    });

    yPos = doc.lastAutoTable.finalY + 10;
  });

  // --- PAGE Y: GOVERNANCE & TRACEABILITY (PYTHON SCRIPT) ---
  if (executiveContent.python_script) {
    doc.addPage();
    yPos = margin;
    
    drawSectionHeader("8. Gobernanza y Trazabilidad (Script de Limpieza)");
    
    doc.setFont('times', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(colors.red);
    doc.text("ATENCIÓN: Código generado automáticamente por IA. Requiere revisión humana (HITL) antes de ejecución en producción.", margin, yPos - 3);
    yPos += 5;

    // Simulate code block background
    const scriptLines = doc.splitTextToSize(executiveContent.python_script, pageWidth - margin * 2 - 10);
    const boxHeight = scriptLines.length * 5 + 10;
    
    // If the box is too big for the page, we'll just let it overflow normally or we can draw multiple pages.
    // For simplicity, we draw the background for whatever fits or just don't draw the gray box if it's too complex.
    // We'll draw a simple border and use courier font.
    doc.setFillColor(248, 250, 252); // Very light gray/blue
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, yPos, pageWidth - margin * 2, Math.min(boxHeight, pageHeight - margin - yPos), 'FD');

    doc.setFont('courier', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85); // Slate 700
    
    // Handle multi-page script if it's very long
    let codeYPos = yPos + 6;
    scriptLines.forEach((line: string) => {
      if (codeYPos > pageHeight - margin) {
        doc.addPage();
        codeYPos = margin;
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, codeYPos, pageWidth - margin * 2, pageHeight - margin * 2, 'FD');
        codeYPos += 6;
      }
      doc.text(line, margin + 5, codeYPos);
      codeYPos += 5;
    });

    yPos = codeYPos + 10;
  }

  // Footer
  addFooters();

  doc.save('Aura_Data_Lab_Diagnostico.pdf');
};
