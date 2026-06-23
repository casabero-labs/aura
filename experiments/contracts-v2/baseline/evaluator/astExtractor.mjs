/**
 * AST-based action extraction for Python cleaning scripts.
 * Uses Python's ast.parse to structurally analyze scripts.
 *
 * Extracts:
 * - Column references (df['col'], df_clean['col'])
 * - Method calls chained on columns (.str.strip(), .fillna(), etc.)
 * - Assignments to df_clean
 * - Return statements
 * - clean_dataset function definition
 */

import { execFileSync } from 'node:child_process';

/**
 * Extract actions from a Python script using AST.
 * Falls back to regex if Python is unavailable.
 */
export function extractActionsAST(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') {
    return emptyResult('empty script');
  }

  // Try Python AST first
  const pyResult = tryPythonAST(scriptText);
  if (pyResult) return pyResult;

  // Fallback to regex if Python AST not available
  return extractActionsRegex(scriptText);
}

function emptyResult(error) {
  return {
    valid: false,
    error: error || 'empty',
    columns: [],
    actions: [],
    assignments: [],
    returns: [],
    hasCleanDataset: false,
    hasDfCleanCopy: false,
    hasReturnDfClean: false,
    copyTargets: [],
    returnVars: [],
    fallback: 'empty'
  };
}

/**
 * Run Python AST analysis via child_process.
 */
function tryPythonAST(scriptText) {
  try {
    const pythonCode = `
import ast, json, sys

script = sys.stdin.read()

try:
    tree = ast.parse(script)
except SyntaxError as e:
    error_result = {
        "valid": False,
        "error": str(e),
        "columns": [],
        "actions": [],
        "assignments": [],
        "returns": [],
        "hasCleanDataset": False,
        "hasDfCleanCopy": False,
        "hasReturnDfClean": False,
        "copyTargets": [],
        "returnVars": [],
        "fallback": "syntax_error"
    }
    print(json.dumps(error_result))
    sys.exit(0)


def extract_column(subscript_node):
    if isinstance(subscript_node, ast.Subscript):
        if isinstance(subscript_node.value, ast.Name) and subscript_node.value.id in ('df', 'df_clean'):
            slice_node = subscript_node.slice
            # Python 3.9+: slice is direct; earlier: wrapped in ast.Index
            if hasattr(ast, 'Index') and isinstance(slice_node, ast.Index):
                slice_node = slice_node.value
            if isinstance(slice_node, ast.Constant) and isinstance(slice_node.value, str):
                return slice_node.value
    return None


columns = set()
actions = []
assignments = []
returns = []
has_clean_dataset = False
has_df_clean_copy = False
has_return_df_clean = False
copy_targets = set()
return_vars = set()

for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef):
        if node.name == 'clean_dataset':
            has_clean_dataset = True
    elif isinstance(node, ast.Assign):
        assignments.append({"type": "Assign"})
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            target_name = node.targets[0].id
            value = node.value
            if isinstance(value, ast.Call):
                if isinstance(value.func, ast.Attribute) and value.func.attr == 'copy':
                    if isinstance(value.func.value, ast.Name):
                        source = value.func.value.id
                        if source == 'df':
                            copy_targets.add(target_name)
                            if target_name == 'df_clean':
                                has_df_clean_copy = True
            if isinstance(value, ast.Subscript):
                col = extract_column(value)
                if col:
                    columns.add(col)
                    actions.append({"type": "subscript_assign", "column": col, "target": target_name})

        # Also walk the RHS to find column accesses and method calls
        for sub_node in ast.walk(node.value):
            if isinstance(sub_node, ast.Subscript):
                col = extract_column(sub_node)
                if col:
                    columns.add(col)
            elif isinstance(sub_node, ast.Call) and isinstance(sub_node.func, ast.Attribute):
                # Find base of method chain
                base = sub_node.func.value
                while isinstance(base, ast.Attribute):
                    base = base.value
                if isinstance(base, ast.Subscript):
                    col = extract_column(base)
                    if col:
                        columns.add(col)
                        attr = sub_node.func.attr
                        actions.append({"type": f"call_{attr}", "method": attr, "column": col})
                elif isinstance(base, ast.Name) and base.id in ('df', 'df_clean'):
                    attr = sub_node.func.attr
                    actions.append({"type": f"call_{attr}", "method": attr, "target": base.id})
    elif isinstance(node, ast.Return):
        returns.append({"type": "Return"})
        if isinstance(node.value, ast.Name):
            return_vars.add(node.value.id)
            if node.value.id == 'df_clean':
                has_return_df_clean = True
    elif isinstance(node, ast.Expr):
        # Handle df['col'] standalone expressions
        if isinstance(node.value, ast.Subscript):
            col = extract_column(node.value)
            if col:
                columns.add(col)
        # Handle df['col'].method() chained calls
        if isinstance(node.value, ast.Call):
            call = node.value
            if isinstance(call.func, ast.Attribute):
                attr = call.func.attr
                # Walk up the chain to find the base subscript
                base = call.func.value
                while isinstance(base, ast.Attribute):
                    base = base.value
                if isinstance(base, ast.Subscript):
                    col = extract_column(base)
                    if col:
                        columns.add(col)
                        actions.append({"type": f"call_{attr}", "method": attr, "column": col})
                elif isinstance(base, ast.Name):
                    target = base.id
                    if target in ('df', 'df_clean'):
                        actions.append({"type": f"call_{attr}", "method": attr, "target": target})

result = {
    "valid": True,
    "error": None,
    "columns": sorted(list(columns)),
    "actions": actions,
    "assignments": [{"type": "Assign"}],
    "returns": [{"type": "Return"}],
    "hasCleanDataset": has_clean_dataset,
    "hasDfCleanCopy": has_df_clean_copy,
    "hasReturnDfClean": has_return_df_clean,
    "copyTargets": sorted(list(copy_targets)),
    "returnVars": sorted(list(return_vars)),
    "fallback": "python_ast"
}
print(json.dumps(result))
`;
    const output = execFileSync('python3', ['-c', pythonCode], {
      input: scriptText,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 5 * 1024 * 1024
    });
    return JSON.parse(output.trim());
  } catch (e) {
    return null;
  }
}

/**
 * Regex fallback when Python AST is not available.
 */
function extractActionsRegex(scriptText) {
  const columns = new Set();
  const actions = [];

  // Find column references in df['col'] or df_clean['col']
  const colMatches = scriptText.matchAll(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]/g);
  for (const m of colMatches) {
    columns.add(m[1]);
  }

  // Find method chains
  const methodMatches = scriptText.matchAll(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)/g);
  for (const m of methodMatches) {
    columns.add(m[1]);
    actions.push({ type: `call_${m[2]}`, method: m[2], column: m[1] });
  }

  // Find function calls on df/df_clean
  const dfMethodMatches = scriptText.matchAll(/(?:df|df_clean)\s*\.\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/g);
  for (const m of dfMethodMatches) {
    actions.push({ type: `call_${m[1]}`, method: m[1], target: m[0].includes('df_clean') ? 'df_clean' : 'df' });
  }

  const hasCleanDataset = /def\s+clean_dataset\s*\(/.test(scriptText);
  const hasDfCleanCopy = /df_clean\s*=\s*df\s*\.\s*copy\s*\(/.test(scriptText);
  const hasReturnDfClean = /return\s+df_clean\b/.test(scriptText);

  return {
    valid: true,
    error: null,
    columns: Array.from(columns),
    actions,
    assignments: [{ type: 'Assign' }],
    returns: [{ type: 'Return' }],
    hasCleanDataset,
    hasDfCleanCopy,
    hasReturnDfClean,
    copyTargets: hasDfCleanCopy ? ['df_clean'] : [],
    returnVars: hasReturnDfClean ? ['df_clean'] : [],
    fallback: 'regex'
  };
}

/**
 * Classify a method call into a safe or unsafe action.
 */
export function classifyAction(methodCall, column) {
  if (!methodCall) return { kind: 'unknown', safe: null };

  const method = methodCall.method || '';

  // Trim actions - safe (auto-action candidate)
  if (['strip', 'lstrip', 'rstrip'].includes(method)) {
    return { kind: 'trim_whitespace', safe: true };
  }

  // Destructive actions
  if (['drop', 'dropna', 'drop_duplicates'].includes(method)) {
    return { kind: method, safe: false };
  }

  // Imputation actions (unsafe without HITL)
  if (method === 'fillna') {
    return { kind: 'impute', safe: false };
  }

  // Statistical
  if (['mean', 'median', 'std', 'var'].includes(method)) {
    return { kind: `stat_${method}`, safe: false };
  }

  return { kind: method, safe: null };
}