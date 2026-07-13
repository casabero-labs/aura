#!/usr/bin/env node
import { runAuraRemediationCli } from '../runners/run-aura-remediation.mjs';

process.exitCode = await runAuraRemediationCli(process.argv.slice(2), {
  commandName: 'run-python-representative.mjs',
});
