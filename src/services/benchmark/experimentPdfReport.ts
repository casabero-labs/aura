import { jsPDF } from 'jspdf';
import type { ExperimentCampaignEvidenceDocumentV1 } from './experimentReport';

export interface ExperimentPdfReport {
  filename: string;
  pageCount: number;
  bytes: Uint8Array;
  textContent: string;
}

const stripMarkdown = (value: string): string => value
  .replace(/^#{1,6}\s+/, '')
  .replace(/\*\*/g, '')
  .replace(/`/g, '');

export const generateExperimentPdfReport = (
  document: ExperimentCampaignEvidenceDocumentV1,
  markdown: string,
): ExperimentPdfReport => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const margin = 18;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - (margin * 2);
  let y = 22;

  doc.setProperties({
    title: `Informe de evaluación LLM - ${document.campaign.campaignId}`,
    subject: `Campaña ${document.campaign.campaignId}; ${document.runs.length} corridas`,
    author: 'AURA',
    creator: 'AURA evidence exporter',
    keywords: 'AURA, LLM, evaluación, evidencia reproducible',
  });
  const creationDate = new Date(document.generatedAt);
  if (!Number.isNaN(creationDate.getTime())) doc.setCreationDate(creationDate);
  if (/^[a-f0-9]{32,}$/i.test(document.campaign.configurationHash)) {
    doc.setFileId(document.campaign.configurationHash.slice(0, 32).toUpperCase());
  }

  const ensureSpace = (height: number) => {
    if (y + height > pageHeight - 18) {
      doc.addPage();
      y = 20;
    }
  };

  const addWrapped = (text: string, options: {
    font?: 'helvetica' | 'courier';
    style?: 'normal' | 'bold';
    size?: number;
    color?: [number, number, number];
    gap?: number;
  } = {}) => {
    const size = options.size ?? 9;
    const lineHeight = size * 0.42;
    doc.setFont(options.font ?? 'helvetica', options.style ?? 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...(options.color ?? [25, 25, 25]));
    const lines = doc.splitTextToSize(text || ' ', contentWidth) as string[];
    ensureSpace((lines.length * lineHeight) + (options.gap ?? 3));
    doc.text(lines, margin, y);
    y += (lines.length * lineHeight) + (options.gap ?? 3);
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (line.length === 0) {
      y += 2;
      continue;
    }
    if (line.startsWith('# ')) {
      ensureSpace(18);
      addWrapped(stripMarkdown(line), { style: 'bold', size: 18, color: [25, 25, 25], gap: 6 });
      continue;
    }
    if (line.startsWith('## ')) {
      ensureSpace(16);
      doc.setDrawColor(167, 167, 160);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
      addWrapped(stripMarkdown(line), { style: 'bold', size: 12, color: [25, 25, 25], gap: 4 });
      continue;
    }
    if (line.startsWith('|')) {
      addWrapped(line, { font: 'courier', size: 6.4, color: [85, 83, 78], gap: 1.5 });
      continue;
    }
    if (line.startsWith('- ')) {
      addWrapped(`- ${stripMarkdown(line.slice(2))}`, { size: 8.5, gap: 2 });
      continue;
    }
    addWrapped(stripMarkdown(line), { size: 9, gap: 3 });
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(217, 217, 212);
    doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);
    doc.setFont('times', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(107, 107, 103);
    doc.text(`AURA - Evaluación LLM - ${document.campaign.campaignId}`, margin, pageHeight - 7);
    doc.text(`${page}/${pageCount}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  return {
    filename: 'report.pdf',
    pageCount,
    bytes: new Uint8Array(doc.output('arraybuffer')),
    textContent: markdown,
  };
};
