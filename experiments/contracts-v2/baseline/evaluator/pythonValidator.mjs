/**
 * Python script validator — Fase 0F.
 *
 * - compile(script, "<aura>", "exec") for executability
 * - AST for: clean_dataset function (with type hints), df_clean = df.copy(),
 *   return df_clean inside function, return outside function, direct df mutations
 * - hasDirectDfMutation now used in structurallyValid
 */

import { execFileSync } from 'node:child_process';

/**
 * Full validation of a Python cleaning script.
 */
export function validatePythonSyntax(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') {
    return { syntaxValid: false, error: 'empty script' };
  }
  try {
    const pyCode = `
import ast, json, sys
script = sys.stdin.read()
try:
    tree = ast.parse(script)
except SyntaxError as e:
    print(json.dumps({"valid": False, "error": f"SyntaxError: {e.msg} at line {e.lineno}"}))
    sys.exit(0)
print(json.dumps({"valid": True, "error": None}))
`;
    const output = execFileSync('python3', ['-c', pyCode], {
      input: scriptText,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 5 * 1024 * 1024
    });
    return JSON.parse(output.trim());
  } catch (e) {
    return { syntaxValid: false, error: e.message };
  }
}

/**
 * Validate script executability using compile().
 */
export function validateCompile(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') {
    return { compileValid: false, error: 'empty script' };
  }
  try {
    const pyCode = `
import sys
script = sys.stdin.read()
try:
    compile(script, "<aura>", "exec")
    print('{"compileValid": true, "error": null}')
except SyntaxError as e:
    import json
    print(json.dumps({"compileValid": False, "error": f"{e.msg} at line {e.lineno}"}))
`;
    const output = execFileSync('python3', ['-c', pyCode], {
      input: scriptText,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 5 * 1024 * 1024
    });
    return JSON.parse(output.trim());
  } catch (e) {
    return { compileValid: false, error: e.message };
  }
}

/**
 * Full structural validation using AST — no regex for function signature.
 */
export function validateScriptStructure(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') {
    return {
      syntaxValid: false, compileValid: false,
      hasCleanDatasetDef: false, hasDfCleanCopy: false,
      hasReturnDfClean: false, hasReturnOutsideFunction: false,
      cleanDatasetTyped: false, structurallyValid: false
    };
  }

  const syntax = validatePythonSyntax(scriptText);
  const compileResult = validateCompile(scriptText);

  // AST analysis via Python
  let astResult = {
    hasCleanDatasetDef: false,
    hasDfCleanCopy: false,
    hasReturnDfClean: false,
    hasReturnOutsideFunction: false,
    cleanDatasetTyped: false,
    hasDirectDfMutation: false
  };

  try {
    const pyCode = `
import ast, json, sys

script = sys.stdin.read()
tree = ast.parse(script)

has_clean = False
has_df_clean_copy = False
has_return_df_clean = False
has_return_outside = False
clean_typed = False
has_direct_df_mutation = False


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
    if isinstance(stmt, ast.Assign):
        for target in stmt.targets:
            base_id, _ = get_col_from_subscript(target)
            if base_id == 'df':
                return True
            loc_id, _ = get_loc_col(target)
            if loc_id == 'df':
                return True
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


# Check for return outside function
for node in ast.iter_child_nodes(tree):
    if isinstance(node, ast.Return):
        has_return_outside = True
        break

# Check clean_dataset function
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'clean_dataset':
        has_clean = True
        for arg in node.args.args:
            if arg.annotation:
                clean_typed = True
                break
        if node.returns:
            clean_typed = True
        for child in ast.walk(node):
            if isinstance(child, ast.Return):
                if isinstance(child.value, ast.Name) and child.value.id == 'df_clean':
                    has_return_df_clean = True
    if isinstance(node, ast.Assign):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            t = node.targets[0].id
            v = node.value
            if t == 'df_clean' and isinstance(v, ast.Call):
                if isinstance(v.func, ast.Attribute) and v.func.attr == 'copy':
                    if isinstance(v.func.value, ast.Name) and v.func.value.id == 'df':
                        has_df_clean_copy = True

# Detect df mutations
for stmt in ast.walk(tree):
    if detect_df_mutation(stmt):
        has_direct_df_mutation = True
        break

r = {
    "hasCleanDatasetDef": has_clean,
    "hasDfCleanCopy": has_df_clean_copy,
    "hasReturnDfClean": has_return_df_clean,
    "hasReturnOutsideFunction": has_return_outside,
    "cleanDatasetTyped": clean_typed,
    "hasDirectDfMutation": has_direct_df_mutation
}
print(json.dumps(r))
`;
    const output = execFileSync('python3', ['-c', pyCode], {
      input: scriptText,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 5 * 1024 * 1024
    });
    astResult = JSON.parse(output.trim());
  } catch (e) {
    astResult.hasCleanDatasetDef = /def\s+clean_dataset\s*\(/.test(scriptText);
    astResult.hasDfCleanCopy = /df_clean\s*=\s*df\s*\.\s*copy\s*\(/.test(scriptText);
    astResult.hasReturnDfClean = /return\s+df_clean\b/.test(scriptText);
    astResult.hasReturnOutsideFunction = /^return\s+/m.test(scriptText);
  }

  const compileOk = compileResult.compileValid !== false;
  const syntaxOk = syntax.valid !== false;
  const structurallyValid = compileOk && astResult.hasCleanDatasetDef && astResult.hasDfCleanCopy && astResult.hasReturnDfClean && !astResult.hasReturnOutsideFunction && !astResult.hasDirectDfMutation;

  return {
    syntaxValid: syntaxOk,
    syntaxError: syntax.error || null,
    compileValid: compileOk,
    compileError: compileResult.error || null,
    hasCleanDatasetDef: astResult.hasCleanDatasetDef,
    hasDfCleanCopy: astResult.hasDfCleanCopy,
    hasReturnDfClean: astResult.hasReturnDfClean,
    hasReturnOutsideFunction: astResult.hasReturnOutsideFunction,
    cleanDatasetTyped: astResult.cleanDatasetTyped,
    hasDirectDfMutation: astResult.hasDirectDfMutation,
    structurallyValid
  };
}
