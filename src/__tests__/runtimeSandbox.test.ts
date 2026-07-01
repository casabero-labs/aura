/**
 * Runtime Sandbox Tests — Phase 5 Loop 2
 *
 * Validates sandbox conditions: preflight gating, import whitelist,
 * network/filesystem detection, clean_dataset detection, dangerous builtins,
 * fail-closed behavior. Uses controlled fixture scripts, never real dataset.
 */

import { describe, it, expect } from 'vitest';
import {
  createDefaultSandboxConfig,
  detectCleanDatasetFunction,
  detectNetworkAccess,
  detectFilesystemAccess,
  detectDangerousBuiltins,
  detectBannedImports,
  validateScriptImports,
  executeSandboxed,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_ALLOWED_IMPORTS,
} from '../services/runtimeSandbox';
import type { PreflightResult } from '../services/preflightCheck';
import type { ScriptContractV2 } from '../contracts/llm/types';

// ── Fixture helpers ──

function makeReadyPreflight(): PreflightResult {
  return {
    status: 'ready',
    verification: { valid: true, errors: [] },
    hashMatch: true,
    fingerprintMatch: true,
    acceptedActionsCoherent: true,
    reasons: [],
  };
}

function makeBlockedPreflight(): PreflightResult {
  return {
    status: 'blocked',
    verification: { valid: false, errors: ['CONTRACT_NULL: contract is null'] },
    hashMatch: false,
    fingerprintMatch: false,
    acceptedActionsCoherent: false,
    reasons: ['contract is null or undefined'],
  };
}

function makeContractFixture(scriptText: string, overrides: Partial<ScriptContractV2> = {}): ScriptContractV2 {
  return {
    contractId: 'aura.script.v2',
    contractVersion: '2.0.0',
    remediationRef: 'plan:test123',
    datasetFingerprint: 'sha256:abc123',
    acceptedActionIds: ['act:a1'],
    rejectedActionIds: [],
    excludedActionIds: [],
    columnRefs: [],
    rendererVersion: '2.0.0',
    placeholderVocabularyVersion: '1.0.0',
    scriptText,
    cleanDatasetFn: 'clean_dataset',
    scriptHash: 'abc123',
    validationResult: {
      valid: true,
      errors: [],
      warnings: [],
      pythonSyntax: { state: 'passed' },
    },
    generatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ── Minimal clean dataset fixture ──

const VALID_CLEAN_SCRIPT = `import pandas as pd
import numpy as np

def clean_dataset(df):
    df = df.copy()
    df.columns = df.columns.str.strip().str.lower()
    return df
`;

const SCRIPT_WITHOUT_CLEAN_DATASET = `import pandas as pd
import numpy as np

print("hello world")
`;

const SCRIPT_WITH_NETWORK = `import pandas as pd
import requests

def clean_dataset(df):
    df = df.copy()
    response = requests.get('http://example.com')
    return df
`;

const SCRIPT_WITH_FILESYSTEM = `import pandas as pd
import os

def clean_dataset(df):
    df = df.copy()
    with open('/tmp/data.csv', 'w') as f:
        f.write('test')
    return df
`;

const SCRIPT_WITH_EVAL = `import pandas as pd

def clean_dataset(df):
    df = df.copy()
    code = "print(df.head())"
    eval(code)
    return df
`;

const SCRIPT_WITH_DISALLOWED_IMPORT = `import pandas as pd
from PIL import Image

def clean_dataset(df):
    df = df.copy()
    return df
`;

const SCRIPT_WITH_BANNED_IMPORT = `import pandas as pd
import subprocess

def clean_dataset(df):
    df = df.copy()
    subprocess.call(['ls'])
    return df
`;

// ═══════════════════════════════════════════════════════════
// Config
// ═══════════════════════════════════════════════════════════

describe('Sandbox: default config', () => {
  it('creates default sandbox config with expected values', () => {
    const config = createDefaultSandboxConfig();

    expect(config.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(config.networkDisabled).toBe(true);
    expect(config.filesystemRestricted).toBe(true);
    expect(config.memoryLimitMb).toBeGreaterThan(0);
    expect(config.allowedImports).toEqual(DEFAULT_ALLOWED_IMPORTS);
  });
});

// ═══════════════════════════════════════════════════════════
// clean_dataset detection
// ═══════════════════════════════════════════════════════════

describe('Sandbox: clean_dataset detection', () => {
  it('detects clean_dataset function in valid script', () => {
    expect(detectCleanDatasetFunction(VALID_CLEAN_SCRIPT)).toBe(true);
  });

  it('returns false when clean_dataset is absent', () => {
    expect(detectCleanDatasetFunction(SCRIPT_WITHOUT_CLEAN_DATASET)).toBe(false);
  });

  it('returns false for empty script', () => {
    expect(detectCleanDatasetFunction('')).toBe(false);
  });

  it('matches def clean_dataset with type hints', () => {
    const script = 'def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:\n    return df.copy()';
    expect(detectCleanDatasetFunction(script)).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Network access detection
// ═══════════════════════════════════════════════════════════

describe('Sandbox: network access detection', () => {
  it('detects requests import and usage', () => {
    expect(detectNetworkAccess(SCRIPT_WITH_NETWORK)).toBe(true);
  });

  it('detects urllib', () => {
    expect(detectNetworkAccess('import urllib.request')).toBe(true);
    expect(detectNetworkAccess("urllib.request.urlopen('http://x')")).toBe(true);
  });

  it('detects socket usage', () => {
    expect(detectNetworkAccess("sock = socket.socket()")).toBe(true);
  });

  it('returns false for clean script', () => {
    expect(detectNetworkAccess(VALID_CLEAN_SCRIPT)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Filesystem access detection
// ═══════════════════════════════════════════════════════════

describe('Sandbox: filesystem access detection', () => {
  it('detects open() call', () => {
    expect(detectFilesystemAccess(SCRIPT_WITH_FILESYSTEM)).toBe(true);
  });

  it('detects os.remove', () => {
    expect(detectFilesystemAccess('os.remove("/tmp/f")')).toBe(true);
  });

  it('detects Path() usage', () => {
    expect(detectFilesystemAccess("Path('/tmp/file.csv').read_text()")).toBe(true);
  });

  it('returns false for clean script', () => {
    expect(detectFilesystemAccess(VALID_CLEAN_SCRIPT)).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════
// Dangerous builtins detection
// ═══════════════════════════════════════════════════════════

describe('Sandbox: dangerous builtins detection', () => {
  it('detects eval()', () => {
    const result = detectDangerousBuiltins(SCRIPT_WITH_EVAL);
    expect(result).toContain('eval');
  });

  it('detects exec()', () => {
    const result = detectDangerousBuiltins('exec("print(1)")');
    expect(result).toContain('exec');
  });

  it('detects __import__()', () => {
    const result = detectDangerousBuiltins('m = __import__("os")');
    expect(result.length).toBeGreaterThan(0);
  });

  it('detects compile()', () => {
    const result = detectDangerousBuiltins('compile(src, "<>", "exec")');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty array for clean script', () => {
    const result = detectDangerousBuiltins(VALID_CLEAN_SCRIPT);
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// Banned import detection
// ═══════════════════════════════════════════════════════════

describe('Sandbox: banned imports detection', () => {
  it('detects import os', () => {
    const result = detectBannedImports('import os\nprint("test")');
    expect(result.length).toBeGreaterThan(0);
  });

  it('detects import subprocess', () => {
    const result = detectBannedImports(SCRIPT_WITH_BANNED_IMPORT);
    expect(result.length).toBeGreaterThan(0);
  });

  it('detects from socket import', () => {
    const result = detectBannedImports('from socket import gethostname');
    expect(result.length).toBeGreaterThan(0);
  });

  it('returns empty for clean script', () => {
    const result = detectBannedImports(VALID_CLEAN_SCRIPT);
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// Import validation against whitelist
// ═══════════════════════════════════════════════════════════

describe('Sandbox: import whitelist validation', () => {
  it('accepts pandas and numpy imports', () => {
    const violations = validateScriptImports(VALID_CLEAN_SCRIPT, DEFAULT_ALLOWED_IMPORTS);
    expect(violations).toEqual([]);
  });

  it('rejects disallowed import (PIL)', () => {
    const violations = validateScriptImports(SCRIPT_WITH_DISALLOWED_IMPORT, DEFAULT_ALLOWED_IMPORTS);
    expect(violations.length).toBeGreaterThan(0);
    expect(violations.some(v => v.includes('PIL'))).toBe(true);
  });

  it('rejects banned imports (subprocess)', () => {
    const violations = validateScriptImports(SCRIPT_WITH_BANNED_IMPORT, DEFAULT_ALLOWED_IMPORTS);
    expect(violations.length).toBeGreaterThan(0);
  });

  it('accepts import with custom whitelist', () => {
    const customAllowed = ['pandas', 'numpy', 'PIL'];
    const violations = validateScriptImports(SCRIPT_WITH_DISALLOWED_IMPORT, customAllowed);
    expect(violations).toEqual([]);
  });

  it('returns empty for script with no imports', () => {
    const script = 'x = 1 + 2\nprint(x)';
    const violations = validateScriptImports(script, DEFAULT_ALLOWED_IMPORTS);
    expect(violations).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════
// executeSandboxed: integration
// ═══════════════════════════════════════════════════════════

describe('Sandbox: executeSandboxed', () => {
  it('blocks when preflight is not ready', () => {
    const contract = makeContractFixture(VALID_CLEAN_SCRIPT);
    const preflight = makeBlockedPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('blocked');
    expect(result.preflightBlocked).toBe(true);
    expect(result.error).toContain('preflight not ready');
  });

  it('succeeds with valid script and ready preflight', () => {
    const contract = makeContractFixture(VALID_CLEAN_SCRIPT);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('success');
    expect(result.preflightBlocked).toBe(false);
    expect(result.hasCleanDataset).toBe(true);
    expect(result.networkAccessDetected).toBe(false);
    expect(result.filesystemAccessDetected).toBe(false);
    expect(result.dangerousBuiltinsDetected).toEqual([]);
    expect(result.importViolations).toEqual([]);
    expect(result.error).toBeNull();
    expect(result.logs.length).toBeGreaterThan(0);
  });

  it('fails when clean_dataset is missing', () => {
    const contract = makeContractFixture(SCRIPT_WITHOUT_CLEAN_DATASET);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
    expect(result.hasCleanDataset).toBe(false);
    expect(result.error).toContain('clean_dataset(df) function not found');
  });

  it('fails when network access detected with network disabled', () => {
    const contract = makeContractFixture(SCRIPT_WITH_NETWORK);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
    expect(result.networkAccessDetected).toBe(true);
    expect(result.error).toContain('network access detected');
  });

  it('fails when filesystem access detected with filesystem restricted', () => {
    const contract = makeContractFixture(SCRIPT_WITH_FILESYSTEM);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
    expect(result.filesystemAccessDetected).toBe(true);
    expect(result.error).toContain('filesystem access detected');
  });

  it('fails when dangerous builtins detected', () => {
    const contract = makeContractFixture(SCRIPT_WITH_EVAL);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
    expect(result.dangerousBuiltinsDetected.length).toBeGreaterThan(0);
    expect(result.error).toContain('dangerous builtins');
  });

  it('fails with import violations', () => {
    const contract = makeContractFixture(SCRIPT_WITH_DISALLOWED_IMPORT);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
    expect(result.importViolations.length).toBeGreaterThan(0);
  });

  it('accepts custom sandbox config with network allowed', () => {
    const contract = makeContractFixture(SCRIPT_WITH_NETWORK);
    const preflight = makeReadyPreflight();
    const config = createDefaultSandboxConfig();
    config.networkDisabled = false;

    const result = executeSandboxed(contract, preflight, config);

    // Network is allowed, but clean_dataset is valid, and eval is not present
    // However, the script still has `import requests` which is not in the whitelist
    expect(result.status).toBe('failed');
    expect(result.importViolations.length).toBeGreaterThan(0);
  });

  it('handles empty script gracefully', () => {
    const contract = makeContractFixture('');
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
    expect(result.hasCleanDataset).toBe(false);
  });

  it('includes timestamps and structured logs in result', () => {
    const contract = makeContractFixture(VALID_CLEAN_SCRIPT);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.startedAt).toBeTruthy();
    expect(result.finishedAt).toBeTruthy();
    expect(result.logs.length).toBeGreaterThan(2);
    expect(result.logs[0]).toContain('sandbox initialized');
    expect(result.logs.some(l => l.includes('preflight passed'))).toBe(true);
    expect(result.logs.some(l => l.includes('sandbox validation passed'))).toBe(true);
  });

  it('returns sandbox config in result', () => {
    const contract = makeContractFixture(VALID_CLEAN_SCRIPT);
    const preflight = makeReadyPreflight();
    const config = createDefaultSandboxConfig();
    config.timeoutMs = 5000;

    const result = executeSandboxed(contract, preflight, config);

    expect(result.sandbox.timeoutMs).toBe(5000);
    expect(result.sandbox.networkDisabled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// Edge cases
// ═══════════════════════════════════════════════════════════

describe('Sandbox: edge cases', () => {
  it('detects multiple violations in same script', () => {
    const script = `import os
import requests
import subprocess

def clean_dataset(df):
    df = df.copy()
    eval("print(1)")
    os.remove("/tmp/test")
    requests.get("http://example.com")
    return df
`;
    const contract = makeContractFixture(script);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
    expect(result.dangerousBuiltinsDetected.length).toBeGreaterThan(0);
    expect(result.networkAccessDetected).toBe(true);
    expect(result.filesystemAccessDetected).toBe(true);
    expect(result.importViolations.length).toBeGreaterThan(0);
  });

  it('accepts script with all standard library imports', () => {
    const script = `import pandas as pd
import numpy as np
import json
import csv
import io
import hashlib
import re
import math
import datetime
from collections import Counter
import itertools
from typing import List, Dict

def clean_dataset(df):
    df = df.copy()
    return df
`;
    const contract = makeContractFixture(script);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('success');
    expect(result.importViolations).toEqual([]);
  });

  it('fail-closed: any single violation blocks execution', () => {
    const contract = makeContractFixture(SCRIPT_WITHOUT_CLEAN_DATASET);
    const preflight = makeReadyPreflight();

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('failed');
  });

  it('blocked preflight produces error message with reasons', () => {
    const contract = makeContractFixture(VALID_CLEAN_SCRIPT);
    const preflight: PreflightResult = {
      status: 'blocked',
      verification: { valid: false, errors: ['HASH_MISMATCH'] },
      hashMatch: false,
      fingerprintMatch: true,
      acceptedActionsCoherent: true,
      reasons: ['scriptHash mismatch: stored abc… ≠ recomputed def…'],
    };

    const result = executeSandboxed(contract, preflight);

    expect(result.status).toBe('blocked');
    expect(result.error).toContain('scriptHash mismatch');
  });
});
