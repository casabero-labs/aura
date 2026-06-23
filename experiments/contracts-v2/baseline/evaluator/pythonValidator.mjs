/**
 * Python script validator.
 *
 * Per Fase 0D requirements:
 * - Use ast.parse for syntactic validation (via python3 subprocess)
 * - Verify df_clean = df.copy() is present
 * - Verify return df_clean is present
 * - Verify def clean_dataset(df) is present
 * - Detect forbidden patterns
 */

import { execFileSync } from 'node:child_process';

/**
 * Validate Python script syntactically using ast.parse.
 *
 * @param {string} scriptText - The Python script
 * @returns {{syntaxValid: boolean, error: string|null, ast: Object|null}}
 */
export function validatePythonSyntax(scriptText) {
  if (!scriptText || typeof scriptText !== 'string') {
    return { syntaxValid: false, error: 'empty script', ast: null };
  }

  try {
    const pythonCode = `
import ast, json, sys
script = sys.stdin.read()
try:
    tree = ast.parse(script)
except SyntaxError as e:
    print(json.dumps({"valid": False, "error": f"SyntaxError: {e.msg} at line {e.lineno}"}))
    sys.exit(0)
print(json.dumps({"valid": True, "error": None}))
`;
    const output = execFileSync('python3', ['-c', pythonCode], {
      input: scriptText,
      encoding: 'utf-8',
      timeout: 10000,
      maxBuffer: 5 * 1024 * 1024
    });
    const result = JSON.parse(output.trim());
    return {
      syntaxValid: result.valid,
      error: result.error,
      ast: result.valid ? { parsed: true } : null
    };
  } catch (e) {
    return { syntaxValid: false, error: e.message, ast: null };
  }
}

/**
 * Check that df_clean = df.copy() is present in the script.
 */
export function hasDfCleanCopy(scriptText) {
  if (!scriptText) return false;
  return /df_clean\s*=\s*df\s*\.\s*copy\s*\(/.test(scriptText);
}

/**
 * Check that return df_clean is present in the script.
 */
export function hasReturnDfClean(scriptText) {
  if (!scriptText) return false;
  return /return\s+df_clean\b/.test(scriptText);
}

/**
 * Check that def clean_dataset(df) is present.
 */
export function hasCleanDatasetDef(scriptText) {
  if (!scriptText) return false;
  return /def\s+clean_dataset\s*\(\s*df\s*\)/.test(scriptText);
}

/**
 * Full structural validation of a cleaning script.
 */
export function validateScriptStructure(scriptText) {
  const syntax = validatePythonSyntax(scriptText);
  const hasDfCopy = hasDfCleanCopy(scriptText);
  const hasReturn = hasReturnDfClean(scriptText);
  const hasDef = hasCleanDatasetDef(scriptText);

  return {
    syntaxValid: syntax.syntaxValid,
    syntaxError: syntax.error,
    hasDfCleanCopy: hasDfCopy,
    hasReturnDfClean: hasReturn,
    hasCleanDatasetDef: hasDef,
    structurallyValid: syntax.syntaxValid && hasDfCopy && hasReturn && hasDef
  };
}