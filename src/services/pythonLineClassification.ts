export type PythonOperationKind = 'destructiva' | 'transformacion' | 'lectura';

export function stripPythonComment(line: string): string {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return '';
  let inSingle = false;
  let inDouble = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const prev = line[index - 1];
    if (char === "'" && !inDouble && prev !== '\\') inSingle = !inSingle;
    else if (char === '"' && !inSingle && prev !== '\\') inDouble = !inDouble;
    else if (char === '#' && !inSingle && !inDouble) return line.slice(0, index);
  }
  return line;
}

export function classifyPythonLine(line: string): PythonOperationKind | null {
  const code = stripPythonComment(line).toLowerCase();
  if (!code.trim()) return null;
  if (/\bdrop_duplicates\s*\(/.test(code) || /\bfillna\s*\(/.test(code) || /\.replace\s*\(/.test(code)
    || /\bastype\s*\(/.test(code) || /\brename\s*\(/.test(code) || /\bassign\s*\(/.test(code)
    || /\.map\s*\(/.test(code) || /\.apply\s*\(/.test(code) || /\.clip\s*\(/.test(code)
    || /\.str\./.test(code) || /\.where\s*\(/.test(code) || /\.loc\[/.test(code) || /\.iloc\[/.test(code)) {
    return 'transformacion';
  }
  if (/\.drop\s*\(/.test(code) || /\bdropna\s*\(/.test(code) || /\bdel\s+/.test(code)
    || /\.pop\s*\(/.test(code) || /\.truncate\s*\(/.test(code) || /\.to_csv\s*\(/.test(code)
    || /\.to_excel\s*\(/.test(code) || /\binplace\s*=\s*true/.test(code)) {
    return 'destructiva';
  }
  if (/\b(value_counts|describe|isna|isnull|info|head|tail|shape|columns|dtypes|unique|nunique)\b/.test(code)) {
    return 'lectura';
  }
  return null;
}
