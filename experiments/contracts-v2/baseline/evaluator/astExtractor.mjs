/**
 * AST-based action extraction — Fase 0F (freeze).
 *
 * One canonical action per AST statement.
 * actionId: L{lineno}:{column}:{actionType}
 * inplace fillna(..., inplace=True) → single action with inplace=true.
 * Detects direct mutations on df for structural validity.
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
                   'count', 'sum', 'describe', 'value_counts'}

columns = set()
actions = []
seen_linenos = set()
has_clean_dataset = False
has_df_clean_copy = False
has_return_df_clean = False
has_return_outside_function = False
has_direct_df_mutation = False
clean_dataset_sig = None


def get_col_from_subscript(node):
    if isinstance(node, ast.Subscript):
        if isinstance(node.value, ast.Name) and node.value.id in ('df', 'df_clean'):
            s = node.slice
            if hasattr(ast, 'Index') and isinstance(s, ast.Index):
                s = s.value
            if isinstance(s, ast.Constant) and isinstance(s.value, str):
                return node.value.id, s.value
    return None, None


def get_loc_col(node):
    if isinstance(node, ast.Subscript):
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


def detect_df_mutation(stmt):
    """Detect if a statement mutates df (not df_clean)."""
    # df['col'] = ... or df.loc[...] = ...
    if isinstance(stmt, ast.Assign):
        for target in stmt.targets:
            base_id, _ = get_col_from_subscript(target)
            if base_id == 'df':
                return True
            loc_id, _ = get_loc_col(target)
            if loc_id == 'df':
                return True
    # df.method(inplace=True) or df['col'].method(inplace=True)
    if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
        call = stmt.value
        for kw in call.keywords:
            if kw.arg == 'inplace' and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                base = call.func.value
                while isinstance(base, ast.Attribute):
                    base = base.value
                if isinstance(base, ast.Name) and base.id == 'df':
                    return True
                if isinstance(base, ast.Subscript):
                    bid, _ = get_col_from_subscript(base)
                    if bid == 'df':
                        return True
    return False


def make_action_id(lineno, col):
    return f"L{lineno}:{col or 'ALL'}"


def add_action(lineno, node_type, action_type, col, target, safe, inplace=False):
    action_id = make_action_id(lineno, col)
    if action_id in seen_linenos:
        return
    seen_linenos.add(action_id)
    act = {
        "actionId": action_id,
        "lineno": lineno,
        "nodeType": node_type,
        "actionType": action_type,
        "column": col,
        "target": target,
        "safe": safe
    }
    if inplace:
        act["inplace"] = True
    actions.append(act)


# Check clean_dataset function
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'clean_dataset':
        has_clean_dataset = True
        has_annotation = any(a.annotation for a in node.args.args) or node.returns is not None
        clean_dataset_sig = "typed" if has_annotation else "untyped"

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


def process_stmts(stmts):
    global has_direct_df_mutation
    for stmt in stmts:
        # Check for df mutations
        if detect_df_mutation(stmt):
            has_direct_df_mutation = True

        # --- Expr: standalone method calls (handles inplace FIRST) ---
        if isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            call = stmt.value
            if isinstance(call.func, ast.Attribute):
                attr = call.func.attr
                lineno = stmt.lineno

                # Check inplace=True FIRST — single action, no fallthrough
                is_inplace = False
                for kw in call.keywords:
                    if kw.arg == 'inplace' and isinstance(kw.value, ast.Constant) and kw.value.value is True:
                        is_inplace = True
                        break

                if is_inplace:
                    base = call.func.value
                    while isinstance(base, ast.Attribute):
                        base = base.value
                    col = None
                    if isinstance(base, ast.Subscript):
                        _, col = get_col_from_subscript(base)
                    if col:
                        columns.add(col)
                    add_action(lineno, 'call', attr, col or None, None, False, inplace=True)
                    # Do NOT fall through to general handler
                    # Recurse into function bodies and continue
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
                    continue

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

        # --- Assign: df['col'] = ... or df_clean['col'] = ... ---
        if isinstance(stmt, ast.Assign):
            lineno = stmt.lineno
            target_name = None
            if len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Name):
                target_name = stmt.targets[0].id

            # df.loc[cond, 'col'] = ...
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
                            action_type = 'impute'
                        elif isinstance(func, ast.Attribute) and func.attr in COMPUTE_METHODS:
                            continue
                        elif isinstance(func, ast.Attribute) and func.attr == 'fillna':
                            action_type = 'impute'
                        else:
                            action_type = 'loc_assign'
                    add_action(lineno, 'loc_assign', action_type, loc_col, base_id, False)
                    continue

            # df['col'] = ... (subscript assign)
            if len(stmt.targets) == 1 and isinstance(stmt.targets[0], ast.Subscript):
                base_id, col = get_col_from_subscript(stmt.targets[0])
                if col:
                    columns.add(col)
                    rhs = stmt.value

                    if isinstance(rhs, ast.Call):
                        func = rhs.func
                        if isinstance(func, ast.Attribute) and func.attr == 'fillna':
                            if rhs.args:
                                arg = rhs.args[0]
                                if isinstance(arg, ast.Call) and isinstance(arg.func, ast.Attribute):
                                    if arg.func.attr in ('mean', 'median', 'mode'):
                                        add_action(lineno, 'fillna', 'impute', col, target_name or base_id, False)
                                        continue
                            add_action(lineno, 'fillna', 'impute', col, target_name or base_id, False)
                            continue

                        if isinstance(func, ast.Attribute) and func.attr in ('strip', 'lstrip', 'rstrip'):
                            base = func.value
                            while isinstance(base, ast.Attribute):
                                base = base.value
                            if isinstance(base, ast.Subscript):
                                add_action(lineno, 'call', func.attr, col, target_name or base_id, True)
                                continue

                        if isinstance(func, ast.Attribute) and func.attr == 'replace':
                            add_action(lineno, 'call', 'replace', col, target_name or base_id, False)
                            continue

                        if isinstance(func, ast.Attribute) and func.attr == 'transform':
                            add_action(lineno, 'transform', 'impute', col, target_name or base_id, False)
                            continue

                        if isinstance(func, ast.Attribute) and func.attr in COMPUTE_METHODS:
                            continue

                    add_action(lineno, 'subscript_assign', 'subscript_assign', col, target_name or base_id, False)
                    continue

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
    "hasDirectDfMutation": has_direct_df_mutation,
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
  const seenIds = new Set();

  const colMatches = scriptText.matchAll(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]/g);
  for (const m of colMatches) {
    columns.add(m[1]);
  }

  let lineno = 0;

  function addRegexAction(nodeType, actionType, col, target, safe, inplace) {
    const actionId = `L${lineno}:${col || 'ALL'}:${actionType}`;
    if (seenIds.has(actionId)) return;
    seenIds.add(actionId);
    const act = { actionId, lineno, nodeType, actionType, column: col, target, safe };
    if (inplace) act.inplace = true;
    actions.push(act);
  }

  for (const line of scriptText.split('\n')) {
    lineno++;

    // inplace=True — single action
    if (/inplace\s*=\s*True/.test(line)) {
      const method = line.match(/\.(\w+)\s*\(/);
      if (method && ['fillna', 'dropna'].includes(method[1])) {
        const col = (line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]/) || [])[1];
        addRegexAction('call', method[1], col || null, 'df', false, true);
        continue;
      }
    }

    const fillnaMean = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*fillna\s*\(\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*(mean|median)\s*\(\s*\)/);
    if (fillnaMean) {
      addRegexAction('fillna', 'impute', fillnaMean[1], 'df', false);
      continue;
    }

    const locNan = line.match(/(?:df|df_clean)\.loc\[.*?,\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:np\.nan|None)/);
    if (locNan) {
      addRegexAction('loc_assign', 'set_nan', locNan[1], 'df', false);
      continue;
    }

    const locAssign = line.match(/(?:df|df_clean)\.loc\[.*?,\s*['"]([^'"]+)['"]\s*\]\s*=\s*(.*)/);
    if (locAssign) {
      const col = locAssign[1];
      const rhs = locAssign[2].trim();
      const actionType = (rhs === 'np.nan' || rhs === 'None') ? 'set_nan' : 'loc_assign';
      addRegexAction('loc_assign', actionType, col, 'df', false);
      continue;
    }

    const stripMatch = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*str\.(strip|lstrip|rstrip)\(\)/);
    if (stripMatch) {
      addRegexAction('call', stripMatch[2], stripMatch[1], 'df', true);
      continue;
    }

    const fillnaSubscript = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*fillna\s*\(/);
    if (fillnaSubscript) {
      addRegexAction('fillna', 'impute', fillnaSubscript[1], 'df', false);
      continue;
    }

    const replaceMatch = line.match(/(?:df|df_clean)\s*\[\s*['"]([^'"]+)['"]\s*\]\s*=\s*(?:df|df_clean)\s*\[\s*['"][^'"]+['"]\s*\]\s*\.\s*replace\s*\(/);
    if (replaceMatch) {
      addRegexAction('call', 'replace', replaceMatch[1], 'df', false);
      continue;
    }

    const dropnaSubset = line.match(/(?:df|df_clean)\s*\.\s*dropna\s*\(\s*subset\s*=\s*\[([^\]]+)\]/);
    if (dropnaSubset) {
      const cols = [...dropnaSubset[1].matchAll(/['"]([^'"]+)['"]/g)];
      for (const cm of cols) {
        addRegexAction('dropna', 'dropna', cm[1], 'df', false);
      }
      continue;
    }

    const dropna = line.match(/(?:df|df_clean)\s*\.\s*dropna\s*\(\)/);
    if (dropna) {
      addRegexAction('dropna', 'dropna', null, 'df', false);
      continue;
    }
  }

  const hasCleanDataset = /def\s+clean_dataset\s*\(/.test(scriptText);
  const hasDfCleanCopy = /df_clean\s*=\s*df\s*\.\s*copy\s*\(/.test(scriptText);
  const hasReturnDfClean = /return\s+df_clean\b/.test(scriptText);
  const hasReturnOutsideFunction = /^return\s+/m.test(scriptText) && !/def\s+.*:\s*\n\s*return/.test(scriptText);

  // Detect df mutations via regex
  let hasDirectDfMutation = false;
  const dfMutationPatterns = [
    /(?:^|\s)df\s*\[/,                    // df['col'] = ...
    /(?:^|\s)df\.loc\[/,                  // df.loc[...] = ...
    /df\s*\.\s*(?:dropna|drop|fillna)\s*\([^)]*inplace\s*=\s*True/i
  ];
  for (const pat of dfMutationPatterns) {
    if (pat.test(scriptText)) {
      hasDirectDfMutation = true;
      break;
    }
  }

  return {
    valid: true,
    error: null,
    columns: Array.from(columns),
    canonicalActions: actions,
    hasCleanDataset,
    hasDfCleanCopy,
    hasReturnDfClean,
    hasReturnOutsideFunction,
    hasDirectDfMutation,
    cleanDatasetSignature: hasCleanDataset ? 'regex_inferred' : null,
    fallback: 'regex'
  };
}
