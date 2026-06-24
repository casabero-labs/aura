/**
 * Python script validator — Fase 0E.
 *
 * - compile(script, "<aura>", "exec") for executability
 * - AST for: clean_dataset function (with type hints), df_clean = df.copy(),
 *   return df_clean inside function, return outside function, direct df mutations
 * - No regex for function signature detection
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
    cleanDatasetTyped: false
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

# Check for return outside function
for node in ast.iter_child_nodes(tree):
    if isinstance(node, ast.Return):
        has_return_outside = True

# Check clean_dataset function
for node in ast.walk(tree):
    if isinstance(node, ast.FunctionDef) and node.name == 'clean_dataset':
        has_clean = True
        # Check type hints
        for arg in node.args.args:
            if arg.annotation:
                clean_typed = True
                break
        if node.returns:
            clean_typed = True
        # Check return df_clean inside function
        for child in ast.walk(node):
            if isinstance(child, ast.Return):
                if isinstance(child.value, ast.Name) and child.value.id == 'df_clean':
                    has_return_df_clean = True
    # Check df_clean = df.copy()
    if isinstance(node, ast.Assign):
        if len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            t = node.targets[0].id
            v = node.value
            if t == 'df_clean' and isinstance(v, ast.Call):
                if isinstance(v.func, ast.Attribute) and v.func.attr == 'copy':
                    if isinstance(v.func.value, ast.Name) and v.func.value.id == 'df':
                        has_df_clean_copy = True

r = {
    "hasCleanDatasetDef": has_clean,
    "hasDfCleanCopy": has_df_clean_copy,
    "hasReturnDfClean": has_return_df_clean,
    "hasReturnOutsideFunction": has_return_outside,
    "cleanDatasetTyped": clean_typed
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
    // Fallback to regex
    astResult.hasCleanDatasetDef = /def\s+clean_dataset\s*\(/.test(scriptText);
    astResult.hasDfCleanCopy = /df_clean\s*=\s*df\s*\.\s*copy\s*\(/.test(scriptText);
    astResult.hasReturnDfClean = /return\s+df_clean\b/.test(scriptText);
    astResult.hasReturnOutsideFunction = /^return\s+/m.test(scriptText);
  }

  const compileOk = compileResult.compileValid !== false;
  const syntaxOk = syntax.valid !== false;
  const structurallyValid = compileOk && astResult.hasCleanDatasetDef && astResult.hasDfCleanCopy && astResult.hasReturnDfClean && !astResult.hasReturnOutsideFunction;

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
    structurallyValid
  };
}
