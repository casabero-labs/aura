import { AuditReport, IssueSeverity, QualityIssue, IssueCategory, ColumnStats, ScoreDeduction } from '../types';

// --- Regex Patterns ---
const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const REGEX_DATE_ISO = /^\d{4}-\d{2}-\d{2}/;
const REGEX_DATE_DMY = /^\d{2}[/-]\d{2}[/-]\d{4}/;
const REGEX_DATETIME = /(?:^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2})?|^\d{2}[/-]\d{2}[/-]\d{4}[ T]\d{2}:\d{2}(?::\d{2})?)/;
const REGEX_TIME = /^\d{1,2}:\d{2}(?::\d{2})?$/;
const REGEX_MOJIBAKE = /\u00C3[\u0080-\u00BF]/; // UTF-8 bytes decoded as Latin-1 (e.g. Ã± for ñ)
const REGEX_IP = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const REGEX_URL = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([\/\w .-]*)*\/?$/;
const REGEX_DOUBLE_SPACE = /\s\s+/;
const REGEX_SYMBOLS = /[!@#$%^&*()_+={}\[\]|\\;:'",.<>?/]/;
const REGEX_CREDIT_CARD = /^(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|6(?:011|5[0-9]{2})[0-9]{12})$/;
const TOXIC_PLACEHOLDERS = ['nan', 'null', 'n/a', '?', 'undefined', 'none', 'nil', 'sin dato', 'no data', '999', 'unknown', '..'];

// --- Semantic Type Detection Patterns ---
const REGEX_PHONE = /^[\+]?[\d\s\(\)\-\.]{7,20}$/;
const REGEX_CURRENCY = /^[\$\€\£\¥]?\s?\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\s?[\$\€\£\¥]?$/;
const REGEX_PERCENTAGE = /^\d+(?:\.\d+)?\s?%$/;
const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REGEX_ZIP = /^\d{4,10}(?:-\d{3,6})?$/;

// Simple hash to avoid massive memory usage for duplicate check
const getFastHash = (obj: any): number => {
  const str = JSON.stringify(obj);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash;
};

// --- Helper Functions ---

const isDate = (val: string): boolean => {
  if (val.length < 8) return false;
  return REGEX_DATE_ISO.test(val) || REGEX_DATE_DMY.test(val);
};

const normalizeTimeValue = (val: any): string | null => {
  if (val === null || val === undefined || val === '') return null;
  const strVal = String(val).trim();
  const timeMatch = strVal.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (!timeMatch) return null;
  const hour = timeMatch[1].padStart(2, '0');
  const minute = timeMatch[2];
  const second = timeMatch[3] || '00';
  return `${hour}:${minute}:${second}`;
};

const looksLikeDateTimeColumn = (col: string, values: any[], rowCount: number): boolean => {
  const lower = col.toLowerCase();
  const nameHint = lower.includes('datetime') || lower.includes('timestamp') || lower.includes('fecha_hora') || lower.includes('date_time');
  const matches = values.filter(v => typeof v === 'string' && REGEX_DATETIME.test(v.trim())).length;
  return nameHint || (rowCount > 0 && matches / rowCount > 0.8);
};

// --- Semantic Type Detection ---

const SEMANTIC_KEYWORDS: Record<string, string[]> = {
  email: ['mail', 'correo', 'email', 'e-mail'],
  phone: ['phone', 'tel', 'cel', 'movil', 'telefono', 'teléfono', 'mobile'],
  url: ['url', 'web', 'link', 'sitio', 'website', 'href'],
  ip: ['ip', 'ipv4', 'ipv6', 'direccion_ip', 'ip_address'],
  uuid: ['uuid', 'guid', 'id'],
  zip: ['zip', 'postal', 'codigo_postal', 'zipcode', 'cp'],
  currency: ['salary', 'wage', 'price', 'amount', 'precio', 'sueldo', 'salario', 'tarifa'],
  percentage: ['rate', 'ratio', 'porcentaje', 'pct', 'percent'],
};

const detectSemanticType = (
  col: string,
  strValues: string[],
  numValues: number[],
  nonNullCount: number
): ColumnStats['semanticType'] => {
  if (nonNullCount === 0) return undefined;

  const lower = col.toLowerCase();
  const sample = 100;
  const strSample = strValues.slice(0, sample);
  const total = Math.min(nonNullCount, sample);

  const emailCount = strSample.filter(v => REGEX_EMAIL.test(v)).length;
  const phoneCount = strSample.filter(v => REGEX_PHONE.test(v)).length;
  const ipCount = strSample.filter(v => REGEX_IP.test(v)).length;
  const urlCount = strSample.filter(v => REGEX_URL.test(v)).length;
  const uuidCount = strSample.filter(v => REGEX_UUID.test(v)).length;
  const zipCount = strSample.filter(v => REGEX_ZIP.test(v)).length;
  const currencyCount = strSample.filter(v => REGEX_CURRENCY.test(v.trim())).length;
  const percentCount = strSample.filter(v => REGEX_PERCENTAGE.test(v.trim())).length;

  const KEYWORD_BONUS = 0.25;
  const THRESHOLD = 0.7;

  const matchesType = (count: number, keywords: string[]): boolean => {
    const ratio = total > 0 ? count / total : 0;
    const keywordHit = keywords.some(k => lower.includes(k));
    return ratio >= THRESHOLD || (ratio >= THRESHOLD * 0.5 && keywordHit);
  };

  if (matchesType(emailCount, SEMANTIC_KEYWORDS.email)) return 'email';
  if (matchesType(phoneCount, SEMANTIC_KEYWORDS.phone)) return 'phone';
  if (matchesType(ipCount, SEMANTIC_KEYWORDS.ip)) return 'ip';
  if (matchesType(urlCount, SEMANTIC_KEYWORDS.url)) return 'url';
  if (matchesType(uuidCount, SEMANTIC_KEYWORDS.uuid)) return 'uuid';
  if (matchesType(zipCount, SEMANTIC_KEYWORDS.zip)) return 'zip';
  if (matchesType(currencyCount, SEMANTIC_KEYWORDS.currency)) return 'currency';
  if (matchesType(percentCount, SEMANTIC_KEYWORDS.percentage)) return 'percentage';

  return undefined;
};

const looksLikeTimeColumn = (col: string, values: any[], rowCount: number): boolean => {
  const lower = col.toLowerCase();
  const nameHint = lower === 'time' || lower === 'hora' || lower.endsWith('_time') || lower.endsWith('_hora');
  const matches = values.filter(v => normalizeTimeValue(v) !== null && !isDate(String(v))).length;
  return nameHint || (rowCount > 0 && matches / rowCount > 0.8);
};

const getQuartiles = (values: number[]) => {
  if (values.length === 0) return { q1: 0, q3: 0, iqr: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
};

const calculateStats = (data: any[], fields: string[]): Record<string, ColumnStats> => {
  const stats: Record<string, ColumnStats> = {};

  fields.forEach(field => {
    const values = data.map(row => row[field]);
    const nonNulls = values.filter(v => 
      v !== null && 
      v !== undefined && 
      v !== '' && 
      !TOXIC_PLACEHOLDERS.includes(String(v).toLowerCase().trim())
    );
    const numValues = nonNulls.filter(v => typeof v === 'number').map(Number);
    const strValues = nonNulls.filter(v => typeof v === 'string').map(String);
    const dateMatches = strValues.filter(v => isDate(v)).length;

    // Inferred Type
    let inferredType: ColumnStats['inferredType'] = 'string';
    if (nonNulls.length > 0) {
      const numPct = numValues.length / nonNulls.length;
      const strPct = strValues.length / nonNulls.length;
      const datePct = dateMatches / nonNulls.length;

      if (numPct > 0.9) inferredType = 'number';
      else if (nonNulls.every(v => typeof v === 'boolean')) inferredType = 'boolean';
      else if (datePct > 0.8) inferredType = 'date';
      else if (numPct > 0.1 && strPct > 0.1) inferredType = 'mixed';
    }

    // Frequencies
    const freqMap = new Map<string, number>();
    nonNulls.forEach(v => {
      const s = String(v);
      freqMap.set(s, (freqMap.get(s) || 0) + 1);
    });

    // Convert map to sorted array
    const sortedFreq = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([value, count]) => ({ value, count }));

    // Get a few random samples for context (start, middle, end)
    const sampleIndices = [0, Math.floor(values.length / 2), values.length - 1].filter(i => i >= 0 && i < values.length);
    const sampleValues = sampleIndices.map(i => values[i]).filter(v => v !== null && v !== undefined).slice(0, 3);

    stats[field] = {
      name: field,
      inferredType,
      semanticType: detectSemanticType(field, strValues, numValues, nonNulls.length),
      nullCount: values.length - nonNulls.length,
      uniqueCount: freqMap.size,
      topFreq: sortedFreq,
      zeros: numValues.filter(n => n === 0).length,
      sampleValues: sampleValues
    };

    if (inferredType === 'number' && numValues.length > 0) {
      stats[field].min = Math.min(...numValues);
      stats[field].max = Math.max(...numValues);
      const sum = numValues.reduce((a, b) => a + b, 0);
      const mean = sum / numValues.length;
      stats[field].mean = mean;

      const sorted = [...numValues].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      stats[field].median = sorted.length % 2 !== 0
        ? sorted[mid]
        : (sorted[mid - 1] + sorted[mid]) / 2;

      const variance = numValues.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / numValues.length;
      const std = Math.sqrt(variance);
      stats[field].std = std;

      if (mean !== 0) {
        stats[field].cv = std / Math.abs(mean);
      }

      if (std > 0) {
        const skewSum = numValues.reduce((acc, val) => acc + Math.pow((val - mean) / std, 3), 0);
        stats[field].skewness = skewSum / numValues.length;
      }

      // IQR computation for numeric columns
      const { q1, q3, iqr } = getQuartiles(numValues);
      stats[field].q1 = q1;
      stats[field].q3 = q3;
      stats[field].iqr = iqr;

      // WARNING: 3× IQR (extreme outliers)
      stats[field].lowerFence = q1 - 3 * iqr;
      stats[field].upperFence = q3 + 3 * iqr;
      stats[field].outlierCount = numValues.filter(n => n < stats[field].lowerFence! || n > stats[field].upperFence!).length;
      stats[field].outlierSeverity = stats[field].outlierCount > 0 ? 'WARNING' : undefined;

      // INFO: 1.5× IQR (Tukey mild outliers)
      stats[field].lowerFenceTukey = q1 - 1.5 * iqr;
      stats[field].upperFenceTukey = q3 + 1.5 * iqr;
      stats[field].outlierCountTukey = numValues.filter(n => n < stats[field].lowerFenceTukey! || n > stats[field].upperFenceTukey!).length;
    }
  });

  return stats;
};

// --- Main Audit Function ---

export const runAudit = (data: Record<string, any>[], fields: string[], delimiter: string): AuditReport => {
  const issues: QualityIssue[] = [];
  const scoreBreakdown: ScoreDeduction[] = [];
  const rowCount = data.length;
  let penaltyPoints = 0;

  const addDeduction = (reason: string, points: number, category: IssueCategory) => {
    penaltyPoints += points;
    scoreBreakdown.push({ reason, points, category });
  };

  // 0. Calculate Basic Stats (Deterministic Layer)
  const colStats = calculateStats(data, fields);

  // --- Group 1: Integrity & Structure ---

  // 1. Exact Duplicates
  const uniqueHashes = new Set();
  let duplicateCount = 0;

  data.forEach(row => {
    const h = getFastHash(row);
    if (uniqueHashes.has(h)) duplicateCount++;
    else uniqueHashes.add(h);
  });

  if (duplicateCount > 0) {
    const pct = (duplicateCount / rowCount) * 100;
    const points = Math.min(15, Math.ceil(pct));
    addDeduction(`Filas Duplicadas (${duplicateCount})`, points, IssueCategory.INTEGRITY);
    issues.push({
      id: 'integrity-dupes',
      ruleName: 'Filas Duplicadas',
      category: IssueCategory.INTEGRITY,
      description: `Se encontraron ${duplicateCount} filas idénticas que afectan la integridad estructural.`,
      severity: IssueSeverity.CRITICAL,
      count: duplicateCount,
      affectedPercentage: pct,
      sampleValues: []
    });
  }

  // Pre-calculate Date Pairs (Simplified for briefness)
  const datePairs: { start: string, end: string }[] = [];
  const dateKeywordsStart = ['start', 'inicio', 'begin', 'open', 'alta'];
  const dateKeywordsEnd = ['end', 'fin', 'finish', 'close', 'baja'];

  fields.forEach(f1 => {
    fields.forEach(f2 => {
      if (f1 === f2) return;
      const l1 = f1.toLowerCase();
      const l2 = f2.toLowerCase();
      if (dateKeywordsStart.some(k => l1.includes(k)) && dateKeywordsEnd.some(k => l2.includes(k))) {
        datePairs.push({ start: f1, end: f2 });
      }
    });
  });

  fields.forEach(col => {
    const stats = colStats[col];
    const values = data.map(r => r[col]);

    // 2. Critical Nulls
    const nullPct = (stats.nullCount / rowCount) * 100;
    if (nullPct > 5) {
      const isCritical = nullPct > 20;
      const points = isCritical ? 10 : 2;
      addDeduction(`Valores Nulos en [${col}]`, points, IssueCategory.INTEGRITY);
      issues.push({
        id: `integrity-null-${col}`,
        column: col,
        ruleName: 'Valores Nulos / Vacíos',
        category: IssueCategory.INTEGRITY,
        description: isCritical ? `Crítico: ${nullPct.toFixed(1)}% de datos faltantes.` : `Advertencia: Faltan datos.`,
        severity: isCritical ? IssueSeverity.CRITICAL : IssueSeverity.WARNING,
        count: stats.nullCount,
        affectedPercentage: nullPct,
        sampleValues: []
      });
    }

    // 3. Constant Column (Low Entropy)
    if (stats.uniqueCount === 1 && rowCount > 10) {
      addDeduction(`Columna Constante [${col}]`, 5, IssueCategory.INTEGRITY);
      issues.push({
        id: `integrity-constant-${col}`,
        column: col,
        ruleName: 'Columna Constante',
        category: IssueCategory.INTEGRITY,
        description: `Todos los valores son idénticos ('${stats.topFreq?.[0]?.value}'). No aporta información.`,
        severity: IssueSeverity.WARNING,
        count: rowCount,
        affectedPercentage: 100,
        sampleValues: [stats.topFreq?.[0]?.value]
      });
    }

    // 4. Mixed Types (Dirty Object) — Skip alphanumeric code columns (R4 fix)
    const isCodeCol = col.toLowerCase().includes('ticket') || col.toLowerCase().includes('code') || col.toLowerCase().includes('ref') || col.toLowerCase().includes('num') || col.toLowerCase().includes('nro');
    if (stats.inferredType === 'mixed' && !isCodeCol) {
      addDeduction(`Tipos Mixtos en [${col}]`, 10, IssueCategory.INTEGRITY);
      const numSample = values.find(v => typeof v === 'number');
      const strSample = values.find(v => typeof v === 'string');
      issues.push({
        id: `integrity-mixed-${col}`,
        column: col,
        ruleName: 'Tipos Mixtos (Dirty Object)',
        category: IssueCategory.INTEGRITY,
        description: `Columna contiene mezcla de números y texto.`,
        severity: IssueSeverity.CRITICAL,
        count: rowCount,
        affectedPercentage: 100,
        sampleValues: [numSample, strSample].filter(Boolean)
      });
    }

    // Prepare for row iteration
    let ghostSpaceCount = 0;
    let mojibakeCount = 0;
    let capChaosSet = new Set<string>();
    let toxicCount = 0;
    let overflowCount = 0;
    let disguisedNumberCount = 0;
    let hiddenDateCount = 0;
    let corruptIdCount = 0;
    let redundantTimeCount = 0;
    let futureDateCount = 0;
    let negativeCount = 0;
    let outlierCount = 0;
    let outlierCountTukey = 0;
    let invalidEmailCount = 0;
    let phoneLengthSums = 0;
    let phoneLengths: number[] = [];
    let piiCount = 0;
    let doubleSpaceCount = 0;
    let urlPatternCount = 0;
    let symbolChaosCount = 0;
    let isoDateCount = 0;
    let dmyDateCount = 0;

    const samples: Record<string, any[]> = {
      ghost: [], mojibake: [], toxic: [], overflow: [], negative: [], outlier: [], email: [], pii: [], disguised: [],
      doubleSpace: [], url: [], symbol: [], futureDate: [], mixedDate: []
    };

    // IQR Calculation for Logic Rule 15
    const numericValues = values.filter(v => typeof v === 'number') as number[];
    let lowerBound = -Infinity, upperBound = Infinity;
    let lowerBoundTukey = -Infinity, upperBoundTukey = Infinity;
    if (numericValues.length > 10) {
      const { q1, q3, iqr } = getQuartiles(numericValues);
      if (iqr > 0) {
        lowerBound = q1 - 3 * iqr;   // WARNING: extreme outlier
        upperBound = q3 + 3 * iqr;
        lowerBoundTukey = q1 - 1.5 * iqr; // INFO: mild outlier (Tukey)
        upperBoundTukey = q3 + 1.5 * iqr;
      }
    }

    const isEmailCol = col.toLowerCase().includes('mail') || col.toLowerCase().includes('correo');
    const isPhoneCol = col.toLowerCase().includes('phone') || col.toLowerCase().includes('tel') || col.toLowerCase().includes('cel') || col.toLowerCase().includes('movil');
    const isIdCol = col.toLowerCase().includes('id') || col.toLowerCase().endsWith('cod') || col.toLowerCase().endsWith('code') || col.toLowerCase().endsWith('key');
    const isUrlCol = col.toLowerCase().includes('url') || col.toLowerCase().includes('web') || col.toLowerCase().includes('link') || col.toLowerCase().includes('sitio');
    const isNameCol = col.toLowerCase().includes('name') || col.toLowerCase().includes('nombre') || col.toLowerCase().includes('ape');
    const isDateTimeLikeColumn = looksLikeDateTimeColumn(col, values, rowCount);

    // --- Row Iteration ---
    values.forEach(val => {
      if (val === null || val === undefined) return;
      const strVal = String(val);

      // Group 2: Hygiene
      // 5. Ghost Spaces
      if (typeof val === 'string' && val.trim().length !== val.length) {
        ghostSpaceCount++;
        if (samples.ghost.length < 3) samples.ghost.push(val);
      }

      // 6. Mojibake
      if (typeof val === 'string' && REGEX_MOJIBAKE.test(val)) {
        mojibakeCount++;
        if (samples.mojibake.length < 3) samples.mojibake.push(val);
      }

      // 7. Cap Chaos (Data Collection)
      if (typeof val === 'string' && val.length > 0) {
        capChaosSet.add(val.toLowerCase());
      }

      // 8. Toxic Placeholders
      if (TOXIC_PLACEHOLDERS.includes(strVal.toLowerCase().trim())) {
        toxicCount++;
        if (samples.toxic.length < 3) samples.toxic.push(val);
      }

      // 9. Text Overflow
      if (typeof val === 'string' && val.length > 300) {
        // Exclude likely description fields
        if (!col.toLowerCase().includes('desc') && !col.toLowerCase().includes('text') && !col.toLowerCase().includes('obs')) {
          overflowCount++;
          if (samples.overflow.length < 3) samples.overflow.push(val.substring(0, 20) + '...');
        }
      }

      // Group 3: Data Types
      // R12: Mixed Date Formats
      if (typeof val === 'string') {
        const isIso = REGEX_DATE_ISO.test(val);
        const isDmy = REGEX_DATE_DMY.test(val);
        if (isIso) isoDateCount++;
        if (isDmy) dmyDateCount++;
        if ((isIso || isDmy) && samples.mixedDate.length < 3) samples.mixedDate.push(val);
      }

      // 10. Disguised Numbers
      if (stats.inferredType === 'string' && !isNaN(Number(val)) && val !== '' && !isPhoneCol && !isIdCol) {
        disguisedNumberCount++;
        if (samples.disguised.length < 3) samples.disguised.push(val);
      }

      // 11. Hidden Dates
      if (stats.inferredType === 'string' && isDate(strVal)) {
        hiddenDateCount++;
      }

      // 12. Corrupt IDs (e.g., "1234.0")
      if (isIdCol && typeof val === 'string' && val.endsWith('.0')) {
        corruptIdCount++;
      }

      // 13. Redundant Time
      if (typeof val === 'string' && (val.endsWith(' 00:00:00') || val.endsWith('T00:00:00'))) {
        redundantTimeCount++;
      }

      // R-Freshness: Future Dates (> today + 30 days)
      if (isDateTimeLikeColumn) {
        const parsedDate = new Date(strVal);
        if (!isNaN(parsedDate.getTime())) {
          const futureThreshold = new Date();
          futureThreshold.setDate(futureThreshold.getDate() + 30);
          if (parsedDate > futureThreshold) {
            futureDateCount++;
            if (samples.futureDate.length < 3) samples.futureDate.push(val);
          }
        }
      }

      // Group 4: Logic
      // 14. Impossible Negatives
      if (typeof val === 'number' && val < 0) {
        // Safe words for negatives
        const safeNegatives = ['diff', 'delta', 'temp', 'lat', 'lon', 'balan', 'profit', 'net', 'score'];
        if (!safeNegatives.some(k => col.toLowerCase().includes(k))) {
          negativeCount++;
          if (samples.negative.length < 3) samples.negative.push(val);
        }
      }

      // 15. Extreme Outliers (3× IQR)
      if (typeof val === 'number' && numericValues.length > 10) {
        if (val < lowerBound || val > upperBound) {
          outlierCount++;
          if (samples.outlier.length < 3) samples.outlier.push(val);
        } else if (val < lowerBoundTukey || val > upperBoundTukey) {
          // Mild outlier: outside 1.5× IQR but inside 3× IQR (Tukey)
          outlierCountTukey++;
        }
      }

      // 17. Invalid Email (skip known placeholders — already caught by R08)
      if (isEmailCol && typeof val === 'string') {
        if (!TOXIC_PLACEHOLDERS.includes(strVal.toLowerCase().trim()) && !REGEX_EMAIL.test(val)) {
          invalidEmailCount++;
          if (samples.email.length < 3) samples.email.push(val);
        }
      }

      // 18. Phone Length Collection
      if (isPhoneCol && typeof val !== 'object') {
        const cleanLen = strVal.replace(/\D/g, '').length;
        if (cleanLen > 0) phoneLengths.push(cleanLen);
      }

      // Group 5: Semantic & Security
      // 19. PII (Sensitive Data)
      if (typeof val === 'string') {
        if (REGEX_IP.test(val) || REGEX_CREDIT_CARD.test(val.replace(/[\s-]/g, ''))) {
          // If column name is obviously PII, it's less of an anomaly, but still a security risk to be aware of
          piiCount++;
          if (samples.pii.length < 3) samples.pii.push(val);
        }
      }

      // 20. Double Spaces
      if (typeof val === 'string' && REGEX_DOUBLE_SPACE.test(val)) {
        doubleSpaceCount++;
        if (samples.doubleSpace.length < 3) samples.doubleSpace.push(val);
      }

      // 21. URL Detection
      if (typeof val === 'string' && (isUrlCol || val.startsWith('http'))) {
        if (!REGEX_URL.test(val)) {
          urlPatternCount++;
          if (samples.url.length < 3) samples.url.push(val);
        }
      }

      // 22. Symbol Chaos in Clean Columns
      if (typeof val === 'string' && (isIdCol || isNameCol) && REGEX_SYMBOLS.test(val)) {
        if (!val.includes('.') || (isIdCol && REGEX_SYMBOLS.test(val.replace(/\./g, '')))) {
          symbolChaosCount++;
          if (samples.symbol.length < 3) samples.symbol.push(val);
        }
      }
    });

    // --- Consolidate & Push Issues ---

    // Group 2 Checks
    if (ghostSpaceCount > 0) {
      addDeduction(`Espacios Fantasma en [${col}]`, 3, IssueCategory.HYGIENE);
      issues.push({ id: `hygiene-ghost-${col}`, column: col, category: IssueCategory.HYGIENE, ruleName: 'Espacios Fantasma (Trim)', description: 'Textos con espacios invisibles al inicio/final.', severity: IssueSeverity.INFO, count: ghostSpaceCount, affectedPercentage: (ghostSpaceCount / rowCount) * 100, sampleValues: samples.ghost });
    }

    if (mojibakeCount > 0) {
      addDeduction(`Encoding Corrupto en [${col}]`, 8, IssueCategory.HYGIENE);
      issues.push({ id: `hygiene-moji-${col}`, column: col, category: IssueCategory.HYGIENE, ruleName: 'Mojibake / Encoding Roto', description: 'Caracteres corruptos (Ã±, etc).', severity: IssueSeverity.WARNING, count: mojibakeCount, affectedPercentage: (mojibakeCount / rowCount) * 100, sampleValues: samples.mojibake });
    }

    if (toxicCount > 0) {
      addDeduction(`Placeholders Tóxicos en [${col}]`, 5, IssueCategory.HYGIENE);
      issues.push({ id: `hygiene-toxic-${col}`, column: col, category: IssueCategory.HYGIENE, ruleName: 'Placeholders Tóxicos', description: 'Valores como "n/a", "null" o "999" detectados.', severity: IssueSeverity.WARNING, count: toxicCount, affectedPercentage: (toxicCount / rowCount) * 100, sampleValues: samples.toxic });
    }

    if (isoDateCount > 0 && dmyDateCount > 0) {
      addDeduction(`Formatos de Fecha Mixtos en [${col}]`, 5, IssueCategory.LOGIC);
      issues.push({ id: `logic-mixed-date-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Formatos de Fecha Mixtos', description: 'Múltiples estándares de fecha (ISO y DMY) en la misma columna.', severity: IssueSeverity.WARNING, count: Math.min(isoDateCount, dmyDateCount), affectedPercentage: (Math.min(isoDateCount, dmyDateCount) / rowCount) * 100, sampleValues: samples.mixedDate });
    }

    if (stats.inferredType === 'string' && stats.uniqueCount > 0) {
      const distinctLower = capChaosSet.size;
      // If unique count > lower unique count, we have "Lima" vs "LIMA"
      if (stats.uniqueCount > distinctLower && stats.uniqueCount < rowCount * 0.8) {
        addDeduction(`Caos de Mayúsculas en [${col}]`, 3, IssueCategory.HYGIENE);
        issues.push({ id: `hygiene-case-${col}`, column: col, category: IssueCategory.HYGIENE, ruleName: 'Caos de Capitalización', description: 'Mismos valores escritos con distintas mayúsculas.', severity: IssueSeverity.INFO, count: stats.uniqueCount - distinctLower, affectedPercentage: 0, sampleValues: [] });
      }
    }

    if (doubleSpaceCount > 0) {
      addDeduction(`Espacios Múltiples en [${col}]`, 2, IssueCategory.HYGIENE);
      issues.push({ id: `hygiene-space-${col}`, column: col, category: IssueCategory.HYGIENE, ruleName: 'Espacios Múltiples', description: 'Cadenas con dobles espacios internos detectados.', severity: IssueSeverity.INFO, count: doubleSpaceCount, affectedPercentage: (doubleSpaceCount / rowCount) * 100, sampleValues: samples.doubleSpace });
    }

    if (symbolChaosCount > 0) {
      addDeduction(`Símbolos Sospechosos en [${col}]`, 5, IssueCategory.HYGIENE);
      issues.push({ id: `hygiene-symbol-${col}`, column: col, category: IssueCategory.HYGIENE, ruleName: 'Símbolos Sospechosos', description: 'Caracteres especiales detectados en columnas de ID o Nombres.', severity: IssueSeverity.WARNING, count: symbolChaosCount, affectedPercentage: (symbolChaosCount / rowCount) * 100, sampleValues: samples.symbol });
    }

    if (urlPatternCount > 0) {
      addDeduction(`Formatos URL Inválidos en [${col}]`, 5, IssueCategory.LOGIC);
      issues.push({ id: `logic-url-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'URL con Formato Erróneo', description: 'Enlaces web que no cumplen la estructura estándar.', severity: IssueSeverity.WARNING, count: urlPatternCount, affectedPercentage: (urlPatternCount / rowCount) * 100, sampleValues: samples.url });
    }

    if (overflowCount > 0) {
      issues.push({ id: `hygiene-over-${col}`, column: col, category: IssueCategory.HYGIENE, ruleName: 'Desbordamiento de Texto', description: 'Cadenas sospechosamente largas (>300 chars).', severity: IssueSeverity.WARNING, count: overflowCount, affectedPercentage: (overflowCount / rowCount) * 100, sampleValues: samples.overflow });
    }

    // Group 3 Checks
    if (disguisedNumberCount > rowCount * 0.95 && stats.inferredType !== 'number') {
      penaltyPoints += 2;
      issues.push({ id: `type-disguised-${col}`, column: col, category: IssueCategory.TYPES, ruleName: 'Números Disfrazados', description: 'Columna de texto que es 100% numérica.', severity: IssueSeverity.INFO, count: disguisedNumberCount, affectedPercentage: (disguisedNumberCount / rowCount) * 100, sampleValues: samples.disguised });
    }

    if (hiddenDateCount > rowCount * 0.95 && stats.inferredType !== 'date') {
      issues.push({ id: `type-date-${col}`, column: col, category: IssueCategory.TYPES, ruleName: 'Fechas Ocultas', description: 'Texto con formato claro de fecha.', severity: IssueSeverity.INFO, count: hiddenDateCount, affectedPercentage: 100, sampleValues: [] });
    }

    if (corruptIdCount > 0) {
      penaltyPoints += 5;
      issues.push({ id: `type-corrupt-${col}`, column: col, category: IssueCategory.TYPES, ruleName: 'IDs Corruptos', description: 'IDs enteros convertidos a float (123.0).', severity: IssueSeverity.WARNING, count: corruptIdCount, affectedPercentage: (corruptIdCount / rowCount) * 100, sampleValues: [] });
    }

    if (redundantTimeCount > rowCount * 0.9) {
      issues.push({ id: `type-time-${col}`, column: col, category: IssueCategory.TYPES, ruleName: 'Hora Redundante', description: 'Sufijo 00:00:00 sin valor real.', severity: IssueSeverity.INFO, count: redundantTimeCount, affectedPercentage: 100, sampleValues: [] });
    }

    // Group 4 Checks
    if (negativeCount > 0) {
      addDeduction(`Negativos en Campo Positivo [${col}]`, 10, IssueCategory.LOGIC);
      issues.push({ id: `logic-neg-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Negativos Imposibles', description: 'Valores negativos en campo lógico (Edad, Precio).', severity: IssueSeverity.CRITICAL, count: negativeCount, affectedPercentage: (negativeCount / rowCount) * 100, sampleValues: samples.negative });
    }

    if (outlierCount > 0) {
      addDeduction(`Outliers en [${col}]`, 5, IssueCategory.LOGIC);
      issues.push({ id: `logic-outlier-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Outliers Extremos (IQR 3×)', description: 'Valores desviados > 3× del rango intercuartílico.', severity: IssueSeverity.WARNING, count: outlierCount, affectedPercentage: (outlierCount / rowCount) * 100, sampleValues: samples.outlier });
    }

    if (outlierCountTukey > 0) {
      addDeduction(`Outliers Leves en [${col}]`, 2, IssueCategory.LOGIC);
      issues.push({ id: `logic-outlier-tukey-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Outliers Leves (Tukey 1.5×)', description: 'Valores desviados entre 1.5× y 3× del rango intercuartílico (mild Tukey outliers).', severity: IssueSeverity.INFO, count: outlierCountTukey, affectedPercentage: (outlierCountTukey / rowCount) * 100, sampleValues: [] });
    }

    if (invalidEmailCount > 0) {
      addDeduction(`Correos Inválidos en [${col}]`, 10, IssueCategory.LOGIC);
      issues.push({ id: `logic-email-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Formato Email Inválido', description: 'Cadenas sin estructura de correo.', severity: IssueSeverity.CRITICAL, count: invalidEmailCount, affectedPercentage: (invalidEmailCount / rowCount) * 100, sampleValues: samples.email });
    }

    // 18. Phone Length Variance
    if (phoneLengths.length > 10) {
      const modeMap = new Map<number, number>();
      phoneLengths.forEach(l => modeMap.set(l, (modeMap.get(l) || 0) + 1));
      let maxFreq = 0;
      let mode = 0;
      modeMap.forEach((freq, len) => { if (freq > maxFreq) { maxFreq = freq; mode = len; } });

      const variableCount = phoneLengths.filter(l => l !== mode).length;
      if (variableCount > phoneLengths.length * 0.1) { // If >10% differ from standard length
        addDeduction(`Longitud Teléfonos Variable [${col}]`, 5, IssueCategory.LOGIC);
        issues.push({ id: `logic-phone-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Longitud de Teléfonos', description: `Longitud variable (Moda: ${mode} dígitos).`, severity: IssueSeverity.WARNING, count: variableCount, affectedPercentage: (variableCount / phoneLengths.length) * 100, sampleValues: [] });
      }
    }

    // Group 5 Checks
    if (piiCount > 0) {
      addDeduction(`Hallazgo PII en [${col}]`, 20, IssueCategory.SEMANTIC);
      issues.push({ id: `sec-pii-${col}`, column: col, category: IssueCategory.SEMANTIC, ruleName: 'Datos Sensibles (PII)', description: 'Patrones de Tarjeta de Crédito o IP detectados.', severity: IssueSeverity.CRITICAL, count: piiCount, affectedPercentage: (piiCount / rowCount) * 100, sampleValues: samples.pii });
    }

    // R-Freshness: Future Dates Detection (> today + 30 days)
    if (futureDateCount > 0) {
      const futurePct = (futureDateCount / rowCount) * 100;
      if (futurePct >= 20) {
        addDeduction(`Fechas Futuras Irrealistas en [${col}]`, 5, IssueCategory.LOGIC);
        issues.push({ id: `logic-freshness-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Fechas Futuras (Freshness)', description: `>${futurePct.toFixed(1)}% de valores son fechas posteriores a hoy + 30 días (típico de defaults de migración como 2099-12-31).`, severity: IssueSeverity.CRITICAL, count: futureDateCount, affectedPercentage: futurePct, sampleValues: samples.futureDate });
      } else if (futurePct > 5) {
        addDeduction(`Fechas Futuras Irrealistas en [${col}]`, 5, IssueCategory.LOGIC);
        issues.push({ id: `logic-freshness-${col}`, column: col, category: IssueCategory.LOGIC, ruleName: 'Fechas Futuras (Freshness)', description: `${futurePct.toFixed(1)}% de valores son fechas posteriores a hoy + 30 días (típico de defaults de migración como 2099-12-31).`, severity: IssueSeverity.WARNING, count: futureDateCount, affectedPercentage: futurePct, sampleValues: samples.futureDate });
      }
    }
  });

  // 16. Incoherencia Temporal (Rule 16) - Cross Column
  datePairs.forEach(pair => {
    let inconsistentCount = 0;
    const sampleInconsistent: any[] = [];

    for (let i = 0; i < data.length; i++) {
      const start = new Date(data[i][pair.start]);
      const end = new Date(data[i][pair.end]);
      if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
        if (end < start) {
          inconsistentCount++;
          if (sampleInconsistent.length < 3) sampleInconsistent.push(`${data[i][pair.end]} < ${data[i][pair.start]}`);
        }
      }
    }

    if (inconsistentCount > 0) {
      addDeduction(`Incoherencia Temporal [${pair.start} vs ${pair.end}]`, 10, IssueCategory.LOGIC);
      issues.push({
        id: `logic-temporal-${pair.start}-${pair.end}`,
        ruleName: 'Incoherencia Temporal',
        category: IssueCategory.LOGIC,
        description: `Fechas ilógicas: ${pair.end} es anterior a ${pair.start}.`,
        severity: IssueSeverity.CRITICAL,
        count: inconsistentCount,
        affectedPercentage: (inconsistentCount / rowCount) * 100,
        sampleValues: sampleInconsistent
      });
    }
  });

  // 23. Redundancia Temporal Derivable - Cross Column
  const temporalCandidates = fields
    .map(field => ({ field, values: data.map(row => row[field]) }))
    .filter(candidate => looksLikeDateTimeColumn(candidate.field, candidate.values, rowCount));

  const timeCandidates = fields
    .map(field => ({ field, values: data.map(row => row[field]) }))
    .filter(candidate => looksLikeTimeColumn(candidate.field, candidate.values, rowCount));

  temporalCandidates.forEach(datetimeCol => {
    timeCandidates.forEach(timeCol => {
      if (datetimeCol.field === timeCol.field) return;

      let comparable = 0;
      let matches = 0;
      const samples: any[] = [];

      for (let i = 0; i < rowCount; i++) {
        const datetimeTime = normalizeTimeValue(data[i][datetimeCol.field]);
        const explicitTime = normalizeTimeValue(data[i][timeCol.field]);
        if (!datetimeTime || !explicitTime) continue;
        comparable++;
        if (datetimeTime === explicitTime) {
          matches++;
          if (samples.length < 3) {
            samples.push(`${datetimeCol.field}=${data[i][datetimeCol.field]} -> ${timeCol.field}=${data[i][timeCol.field]}`);
          }
        }
      }

      if (comparable > 10) {
        const matchPct = (matches / comparable) * 100;
        if (matchPct >= 95) {
          issues.push({
            id: `semantic-temporal-redundancy-${datetimeCol.field}-${timeCol.field}`,
            column: timeCol.field,
            ruleName: 'Redundancia Temporal Derivable',
            category: IssueCategory.SEMANTIC,
            description: `La columna '${timeCol.field}' parece derivarse de '${datetimeCol.field}' en ${matchPct.toFixed(1)}% de filas comparables. Requiere validación de dominio antes de eliminarla.`,
            severity: IssueSeverity.INFO,
            count: matches,
            affectedPercentage: matchPct,
            sampleValues: samples
          });
        }
      }
    });
  });

  let normalizedPenalty = penaltyPoints;
  if (rowCount < 100) {
    normalizedPenalty = penaltyPoints * 1.5;
  } else if (rowCount > 10000) {
    normalizedPenalty = penaltyPoints / 2;
  }
  const totalScore = Math.max(0, Math.min(100, Math.round(100 - normalizedPenalty)));

  return {
    score: totalScore,
    rowCount,
    colCount: fields.length,
    duplicateRows: duplicateCount,
    issues,
    columnStats: colStats,
    scoreBreakdown,
    delimiterDetected: delimiter
  };
};
