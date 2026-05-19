/**
 * Lightweight Python syntax highlighter — zero dependencies.
 * Returns HTML-safe string with <span> tokens for CSS styling.
 */

interface Token {
  type: 'comment' | 'string' | 'keyword' | 'builtin' | 'number' | 'decorator' | 'function' | 'class' | 'operator' | 'plain';
  value: string;
}

const KEYWORDS = new Set([
  'import', 'from', 'as', 'def', 'class', 'return', 'if', 'elif', 'else',
  'for', 'while', 'break', 'continue', 'pass', 'try', 'except', 'finally',
  'raise', 'with', 'yield', 'lambda', 'assert', 'del', 'in', 'is', 'not',
  'and', 'or', 'True', 'False', 'None', 'global', 'nonlocal',
]);

const BUILTINS = new Set([
  'print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set',
  'tuple', 'type', 'isinstance', 'issubclass', 'map', 'filter', 'zip',
  'enumerate', 'sorted', 'reversed', 'sum', 'min', 'max', 'abs', 'round',
  'open', 'input', 'format', 'super', 'property', 'staticmethod',
  'classmethod', 'hasattr', 'getattr', 'setattr', 'delattr', 'repr',
  'any', 'all', 'iter', 'next', 'slice', 'object',
]);

const PANDAS_BUILTINS = new Set([
  'pd', 'np', 'DataFrame', 'Series', 'read_csv', 'read_excel', 'concat',
  'merge', 'groupby', 'fillna', 'dropna', 'replace', 'astype', 'rename',
  'assign', 'apply', 'map', 'clip', 'value_counts', 'describe', 'isna',
  'isnull', 'notna', 'duplicated', 'drop_duplicates', 'to_csv', 'to_excel',
  'loc', 'iloc', 'pivot_table', 'melt', 'crosstab', 'cut', 'qcut',
]);

export const highlightPython = (code: string): string => {
  const tokens: Token[] = [];
  let i = 0;

  while (i < code.length) {
    // Comments
    if (code[i] === '#') {
      let end = code.indexOf('\n', i);
      if (end === -1) end = code.length;
      tokens.push({ type: 'comment', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Triple-quoted strings
    if (code.slice(i, i + 3) === '"""' || code.slice(i, i + 3) === "'''") {
      const quote = code.slice(i, i + 3);
      let end = code.indexOf(quote, i + 3);
      if (end === -1) end = code.length;
      else end += 3;
      tokens.push({ type: 'string', value: code.slice(i, end) });
      i = end;
      continue;
    }

    // Single-quoted strings
    if (code[i] === '"' || code[i] === "'") {
      const quote = code[i];
      let j = i + 1;
      let escaped = false;
      while (j < code.length) {
        if (escaped) { escaped = false; j++; continue; }
        if (code[j] === '\\') { escaped = true; j++; continue; }
        if (code[j] === quote) { j++; break; }
        if (code[j] === '\n') break;
        j++;
      }
      tokens.push({ type: 'string', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // f-strings (simplified)
    if (code[i] === 'f' && (code[i + 1] === '"' || code[i + 1] === "'")) {
      const quote = code[i + 1];
      let j = i + 2;
      let escaped = false;
      while (j < code.length) {
        if (escaped) { escaped = false; j++; continue; }
        if (code[j] === '\\') { escaped = true; j++; continue; }
        if (code[j] === quote) { j++; break; }
        if (code[j] === '\n') break;
        j++;
      }
      tokens.push({ type: 'string', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Decorators
    if (code[i] === '@' && (i === 0 || code[i - 1] === '\n' || code.slice(Math.max(0, i - 4), i).trim() === '')) {
      let j = i + 1;
      while (j < code.length && /[a-zA-Z0-9_.]/.test(code[j])) j++;
      tokens.push({ type: 'decorator', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Numbers
    if (/[0-9]/.test(code[i]) && (i === 0 || !/[a-zA-Z_]/.test(code[i - 1]))) {
      let j = i;
      while (j < code.length && /[0-9.eExXoObB_]/.test(code[j])) j++;
      tokens.push({ type: 'number', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Identifiers & keywords
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i;
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++;
      const word = code.slice(i, j);

      // Check for function call: name(
      let k = j;
      while (k < code.length && code[k] === ' ') k++;
      const isFuncCall = code[k] === '(';

      // Check for class definition
      const prevTrimmed = code.slice(Math.max(0, i - 10), i).trim();
      const isClassDef = prevTrimmed === 'class';

      if (KEYWORDS.has(word)) {
        tokens.push({ type: 'keyword', value: word });
      } else if (BUILTINS.has(word) || PANDAS_BUILTINS.has(word)) {
        tokens.push({ type: 'builtin', value: word });
      } else if (isClassDef) {
        tokens.push({ type: 'class', value: word });
      } else if (isFuncCall) {
        tokens.push({ type: 'function', value: word });
      } else {
        tokens.push({ type: 'plain', value: word });
      }
      i = j;
      continue;
    }

    // Operators
    if ('+-*/%=<>!&|^~'.includes(code[i])) {
      let j = i;
      while (j < code.length && '+-*/%=<>!&|^~'.includes(code[j])) j++;
      tokens.push({ type: 'operator', value: code.slice(i, j) });
      i = j;
      continue;
    }

    // Plain character
    tokens.push({ type: 'plain', value: code[i] });
    i++;
  }

  const typeToClass: Record<Token['type'], string> = {
    comment: 'py-comment',
    string: 'py-string',
    keyword: 'py-keyword',
    builtin: 'py-builtin',
    number: 'py-number',
    decorator: 'py-decorator',
    function: 'py-function',
    class: 'py-class',
    operator: 'py-operator',
    plain: '',
  };

  return tokens
    .map((t) => {
      const cls = typeToClass[t.type];
      if (!cls) return escapeHtml(t.value);
      return `<span class="${cls}">${escapeHtml(t.value)}</span>`;
    })
    .join('');
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
