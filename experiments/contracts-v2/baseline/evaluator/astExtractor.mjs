/**
 * AST-based action extraction — Fase 0E (revised).
 *
 * Produces canonical actions:
 *   { actionId, lineno, nodeType, actionType, column, target, safe }
 *
 * Deduplication: one action per lineno + column + actionType.
 * fillna(mean()) counts as one imputation.
 * Computation (quantile, groupby, transform) is NOT an action.
 */

import { execFileSync } from 'node:child_process';

export function extractActionsAST(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') {
    return emptyResult('empty script');
  }
  const pyResult = tryPythonAST(scriptText);
  if (pyResult) return pyResult;
  return extractActionsRegex(scriptText);
}

function emptyResult(error) {
  return {
    valid: false,
    error: error || 'empty',
    columns: [],
    canonicalActions: [],
    hasCleanDataset: false,
    hasDfCleanCopy: false,
    hasReturnDfClean: false,
    hasReturnOutsideFunction: false,
    hasDirectDfMutation: false,
    cleanDatasetSignature: null,
    fallback: 'empty'
  };
}

function tryPythonAST(scriptText) {
  try {
    const pythonCode = `
import ast, json, sys

script = sys.stdin.read()

try:
    tree = ast.parse(script)
except SyntaxError as e:
    r = {"valid": False, "error": str(e), "columns": [], "canonicalActions": [],
         "hasCleanDataset": False, "hasDfCleanCopy": False, "hasReturnDfClean": False,
         "hasReturnOutsideFunction": False, "hasDirectDfMutation": False,
         "cleanDatasetSignature": None, "fallback": "syntax_error"}
    print(json.dumps(r))
    sys.exit(0)


COMPUTE_METHODS = {'quantile', 'mean', 'median', 'std', 'var', 'min', 'max',
                   'count', 'sum', 'describe', 'value_counts', 'groupby',
                   'transform', 'agg', 'aggregate', 'apply', 'map'}

columns = set()
actions = []
seen_keys = set()
has_clean_dataset = False
has_df_clean_copy = False
has_return_df_clean = False
has_return_outside_function = False
clean_dataset_sig = None


def get_col_from_subscript(node):
    """Extract column from df['col'] or df_clean['col']."""
    if isinstance(node, ast.Subscript):
        if isinstance(node.value, ast.Name) and node.value.id in ('df', 'df_clean'):
            s = node.slice
            if hasattr(ast, 'Index') and isinstance(s, ast.Index):
                s = s.value
            if isinstance(s, ast.Constant) and isinstance(s.value, str):
                return node.value.id, s.value
    return None, None


def get_loc_col(node):
    """Extract column from df.loc[cond, 'col'] or df_clean.loc[cond, 'col'] target."""
    if isinstance(node, ast.Subscript):
        # Check value is df.loc or df_clean.loc
        base_name = None
        if isinstance(node.value, ast.Attribute) and node.value.attr == 'loc':
            inner = node.value.value
            if isinstance(inner, ast.Name) and inner.id in ('df', 'df_clean'):
                base_name = inner.id
        if base_name is None:
            return None, None
        if isinstance(node.slice, ast.Tuple) and len(node.slice.elts) >= 2:
            col_node = node.slice.elts[1]
            if hasattr(ast, 'Index') and isinstance(col_node, ast.Index):
                col_node = col_node.value
            if isinstance(col_node, ast.Constant) and isinstance(col_node.value, str):
                return base_name, col_node.value
    return None, None


def add_action(lineno, node_type, action_type, col, target, safe):
    key = (lineno, col, action_type)
    if key in seen_keys:
        return
    seen_keys.add(key)
    actions.append({
        "lineno": lineno,
        "nodeType": node_type,
        "actionType": action_type,
        "column": col,
        "target": target,
        "safe": safe
    })


# Check clean_dataset function
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'clean_dataset':
        has_clean_dataset = True
        has_annotation = any(a.annotation for a in node.args.args) or node.returns is not None
        clean_dataset_sig = "typed" if has_annotation else "untyped"
    # Check for return outside function
    if isinstance(node, ast.Return):
        # Check if this Return is NOT inside any FunctionDef
        # by checking parent — but ast doesn't store parents
        # so we check if we're at module level
        pass

# Check for return at module level
for node in ast.iter_child_nodes(tree):
    if isinstance(node, ast.Return):
        has_return_outside_function = True

# Check df_clean = df.copy()
for node in ast.walk(tree):
    if isinstance(node, ast.Assign):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            t = node.targets[0].id
            v = node.value
            if t == 'df_clean' and isinstance(v, ast.Call):
                if isinstance(v.func, ast.Attribute) and v.func.attr == 'copy':
                    if isinstance(v.func.value, ast.Name) and v.func.value.id == 'df':
                        has_df_clean_copy = True

# Check return df_clean inside clean_dataset
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'clean_dataset':
        for child in ast.walk(node):
            if isinstance(child, ast.Return):
                if isinstance(child.value, ast.Name) and child.value.id == 'df_clean':
                    has_return_df_clean = True

# Process top-level statements and function body statements
def process_stmts(stmts):
    for stmt in stmts:
        # --- Assign: df['col'] = ... or df_clean['col'] = ... ---
        if isinstance(stmt, ast.Assign):
            lineno = stmt.lineno
            target_name = None
            if len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Name):
                target_name = stmt.targets[0].id

            # Check if target is df.loc[cond, 'col']
            if len(stmt.targets) == 1:
                base_id, loc_col = get_loc_col(stmt.targets[0])
                if loc_col:
                    columns.add(loc_col)
                    rhs = stmt.value
                    action_type = 'loc_assign'
                    if isinstance(rhs, ast.Constant) and rhs.value is None:
                        action_type = 'set_nan'
                    elif isinstance(rhs, ast.Attribute) and isinstance(rhs.value, ast.Name) and rhs.value.id == 'np' and rhs.attr == 'nan':
                        action_type = 'set_nan'
                    elif isinstance(rhs, ast.Name) and rhs.id == 'np':
                        action_type = 'set_nan'
                    elif isinstance(rhs, ast.Call):
                        func = rhs.func
                        if isinstance(func, ast.Attribute) and func.attr == 'transform':
                            # loc[cond, 'col'] = groupby().transform() → impute
                            action_type = 'impute'
                        elif isinstance(func, ast.Attribute) and func.attr in COMPUTE_METHODS:
                            continue  # skip pure computation (quantile, mean, etc.)
                        elif isinstance(func, ast.Attribute) and func.attr == 'fillna':
                            action_type = 'impute'
                        else:
                            action_type = 'loc_assign'
                    add_action(lineno, 'loc_assign', action_type, loc_col, base_id, False)
                    continue

            # Check if target is df['col'] = ... (subscript assign)
            if len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Subscript):
                base_id, col = get_col_from_subscript(stmt.targets[0])
                if col:
                    columns.add(col)
                    rhs = stmt.value

                    # Check fillna(mean/median) → single impute
                    if isinstance(rhs, ast.Call):
                        func = rhs.func
                        if isinstance(func, ast.Attribute) and func.attr == 'fillna':
                            if rhs.args:
                                arg = rhs.args[0]
                                if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Attribute):
                                    if arg.func.attr in ('mean', 'median', 'mode'):
                                        add_action(lineno, 'fillna', 'impute', col, target_name or base_id, False)
                                        continue
                            # fillna with literal
                            add_action(lineno, 'fillna', 'impute', col, target_name or base_id, False)
                            continue

                        # .str.strip/lstrip/rstrip → safe
                        if isinstance(func, ast.Attribute) and func.attr in ('strip', 'lstrip', 'rstrip'):
                            # Check it's chained on the subscript
                            base = func.value
                            while isinstance(base, ast.Attribute):
                                base = base.value
                            if isinstance(base, ast.Subscript):
                                add_action(lineno, 'call', func.attr, col, target_name or base_id, True)
                                continue

                        # .replace() on subscript
                        if isinstance(func, ast.Attribute) and func.attr == 'replace':
                            add_action(lineno, 'call', 'replace', col, target_name or base_id, False)
                            continue

                        # .transform() chain → impute (data modification)
                        if isinstance(func, ast.Attribute) and func.attr == 'transform':
                            add_action(lineno, 'transform', 'impute', col, target_name or base_id, False)
                            continue

                        # Skip compute-only methods (quantile, mean, etc.)
                        if isinstance(func, ast.Attribute) and func.attr in COMPUTE_METHODS:
                            continue

                    # Default: subscript_assign
                    add_action(lineno, 'subscript_assign', 'subscript_assign', col, target_name or base_id, False)
                    continue

        # --- Expr: standalone method calls ---
        if isinstance(stmt, ast.Expr):
            if isinstance(stmt.value, ast.Call):
                call = stmt.value
                if isinstance(call.func, ast.Attribute):
                    attr = call.func.attr
                    lineno = stmt.lineno

                    # dropna(subset=['col']) or dropna()
                    if attr == 'dropna':
                        base = call.func.value
                        while isinstance(base, ast.Attribute):
                            base = base.value
                        target_id = None
                        if isinstance(base, ast.Name) and base.id in ('df', 'df_clean'):
                            target_id = base.id
                        subset_cols = []
                        for kw in call.keywords:
                            if kw.arg == 'subset' and isinstance(kw.value, ast.List):
                                for elt in kw.value.elts:
                                    if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                        subset_cols.append(elt.value)
                        if subset_cols:
                            for c in subset_cols:
                                columns.add(c)
                                add_action(lineno, 'dropna', 'dropna', c, target_id or 'df', False)
                        else:
                            add_action(lineno, 'dropna', 'dropna', None, target_id or 'df', False)
                        continue

                    # Check for inplace=True on any method
                    for kw in call.keywords:
                        if kw.arg == 'inplace' and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                            base = call.func.value
                            while isinstance(base, ast.Attribute):
                                base = base.value
                            col = None
                            if isinstance(base, ast.Subscript):
                                _, col = get_col_from_subscript(base)
                            add_action(lineno, f'inplace_{attr}', f'inplace_{attr}', col, None, False)

                    # fillna on subscript (standalone: df['col'].fillna(...))
                    if attr == 'fillna':
                        base = call.func.value
                        while isinstance(base, ast.Attribute):
                            base = base.value
                        if isinstance(base, ast.Subscript):
                            _, col = get_col_from_subscript(base)
                            if col:
                                columns.add(col)
                                add_action(lineno, 'fillna', 'impute', col, None, False)
                        continue

                    # General method call on subscript (e.g., df['col'].str.strip())
                    base = call.func.value
                    while isinstance(base, ast.Attribute):
                        base = base.value
                    if isinstance(base, ast.Subscript):
                        _, col = get_col_from_subscript(base)
                        if col:
                            columns.add(col)
                            safe = attr in ('strip', 'lstrip', 'rstrip')
                            add_action(lineno, 'call', attr, col, None, safe)

        # Recurse into function bodies
        if isinstance(stmt, ast.FunctionDef):
            process_stmts(stmt.body)
        elif isinstance(stmt, ast.If):
            process_stmts(stmt.body)
            process_stmts(stmt.orelse)
        elif isinstance(stmt, (ast.For, ast.While)):
            process_stmts(stmt.body)
        elif isinstance(stmt, ast.With):
            process_stmts(stmt.body)
        elif isinstance(stmt, ast.Try):
            process_stmts(stmt.body)
            for handler in stmt.handlers:
                process_stmts(handler.body)

# Process top-level and clean_dataset body
process_stmts(tree.body)
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'clean_dataset':
        process_stmts(node.body)

canonical = sorted(actions, key=lambda a: (a['lineno'], a.get('column') or ''))

result = {
    "valid": True,
    "error": None,
    "columns": sorted(list(columns)),
    "canonicalActions": canonical,
    "hasCleanDataset": has_clean_dataset,
    "hasDfCleanCopy": has_df_clean_copy,
    "hasReturnDfClean": has_return_df_clean,
    "hasReturnOutsideFunction": has_return_outside_function,
    "hasDirectDfMutation": False,
    "cleanDatasetSignature": clean_dataset_sig,
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

function extractActionsRegex(scriptText) {
  const columns = new Set();
  const actions = [];
  const seenKeys = new Set();

  // General column extraction from df['col'] or df_clean['col'] references
  const colMatches = scriptText.matchAll(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]/g);
  for (const m of colMatches) {
    columns.add(m[1]);
  }

  let lineno = 0;

  for (const line of scriptText.split('\n')) {
    lineno++;

    // df['col'] = fillna(mean())
    const fillnaMean = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*fillna\s*\(\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*(mean|median)\s*\(\s*\)/);
    if (fillnaMean) {
      const col = fillnaMean[1];
      columns.add(col);
      const key = `${lineno}:${col}:impute`;
      if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'fillna', actionType: 'impute', column: col, target: 'df', safe: false }); }
      continue;
    }

    // df.loc[cond, 'col'] = np.nan
    const locNan = line.match(/(?:df|df_clean)\.loc\[.*?,\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:np\.nan|None)/);
    if (locNan) {
      const col = locNan[1];
      columns.add(col);
      const key = `${lineno}:${col}:set_nan`;
      if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'loc_assign', actionType: 'set_nan', column: col, target: 'df', safe: false }); }
      continue;
    }

    // df.loc[cond, 'col'] = value
    const locAssign = line.match(/(?:df|df_clean)\.loc\[.*?,\s*['"]([^'"]+)['"]\s*\]\s*=\s*(.*)/);
    if (locAssign) {
      const col = locAssign[1];
      const rhs = locAssign[2].trim();
      columns.add(col);
      const actionType = (rhs === 'np.nan' || rhs === 'None') ? 'set_nan' : 'loc_assign';
      const key = `${lineno}:${col}:${actionType}`;
      if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'loc_assign', actionType, column: col, target: 'df', safe: false }); }
      continue;
    }

    // df['col'] = df['col'].str.strip()
    const stripMatch = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*str\.(strip|lstrip|rstrip)\(\)/);
    if (stripMatch) {
      const col = stripMatch[1];
      columns.add(col);
      const key = `${lineno}:${col}:${stripMatch[2]}`;
      if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'call', actionType: stripMatch[2], column: col, target: 'df', safe: true }); }
      continue;
    }

    // df['col'] = df['col'].fillna(...)
    const fillnaSubscript = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*fillna\s*\(/);
    if (fillnaSubscript) {
      const col = fillnaSubscript[1];
      columns.add(col);
      const key = `${lineno}:${col}:impute`;
      if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'fillna', actionType: 'impute', column: col, target: 'df', safe: false }); }
      continue;
    }

    // df['col'] = df['col'].replace(...)
    const replaceMatch = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*replace\s*\(/);
    if (replaceMatch) {
      const col = replaceMatch[1];
      columns.add(col);
      const key = `${lineno}:${col}:replace`;
      if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'call', actionType: 'replace', column: col, target: 'df', safe: false }); }
      continue;
    }

    // dropna(subset=['col'])
    const dropnaSubset = line.match(/(?:df|df_clean)\s*\.\s*dropna\s*\(\s*subset\s*=\s*\[([^\]]+)\]/);
    if (dropnaSubset) {
      const cols = [...dropnaSubset[1].matchAll(/['"]([^'"]+)['"]/g)];
      for (const cm of cols) {
        const col = cm[1];
        columns.add(col);
        const key = `${lineno}:${col}:dropna`;
        if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'dropna', actionType: 'dropna', column: col, target: 'df', safe: false }); }
      }
      continue;
    }

    // dropna()
    const dropna = line.match(/(?:df|df_clean)\s*\.\s*dropna\s*\(\)/);
    if (dropna) {
      const key = `${lineno}:*:dropna`;
      if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: 'dropna', actionType: 'dropna', column: null, target: 'df', safe: false }); }
      continue;
    }

    // inplace=True
    if (/inplace\s*=\s*True/.test(line)) {
      const method = line.match(/\.(\w+)\s*\(/);
      if (method && ['fillna', 'dropna'].includes(method[1])) {
        const col = (line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]/) || [])[1];
        const key = `${lineno}:${col || '*'}:inplace_${method[1]}`;
        if (!seenKeys.has(key)) { seenKeys.add(key); actions.push({ lineno, nodeType: `inplace_${method[1]}`, actionType: `inplace_${method[1]}`, column: col || null, target: 'df', safe: false }); }
      }
    }
  }

  const hasCleanDataset = /def\s+clean_dataset\s*\(/.test(scriptText);
  const hasDfCleanCopy = /df_clean\s*=\s*df\s*\.\s*copy\s*\(/.test(scriptText);
  const hasReturnDfClean = /return\s+df_clean\b/.test(scriptText);
  const hasReturnOutsideFunction = /^return\s+/m.test(scriptText) && !/def\s+.*:\s*\n\s*return/.test(scriptText);

  return {
    valid: true,
    error: null,
    columns: Array.from(columns),
    canonicalActions: actions,
    hasCleanDataset,
    hasDfCleanCopy,
    hasReturnDfClean,
    hasReturnOutsideFunction,
    hasDirectDfMutation: false,
    cleanDatasetSignature: hasCleanDataset ? 'regex_inferred' : null,
    fallback: 'regex'
  };
}
