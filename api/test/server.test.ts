import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { start } from '../src/server.js';

const quiet = { log: () => {}, error: () => {} };

describe('start', () => {
  it('exits with code 1 and does not serve when migrations fail', async () => {
    const exits: number[] = [];
    let served = false;
    const ok = await start({
      migrate: async () => { throw new Error('db down'); },
      serve: () => { served = true; },
      exit: (code) => { exits.push(code); },
      log: quiet,
    });
    assert.equal(ok, false);
    assert.deepEqual(exits, [1]);
    assert.equal(served, false);
  });

  it('serves after successful migrations', async () => {
    const exits: number[] = [];
    let served = false;
    const ok = await start({
      migrate: async () => {},
      serve: () => { served = true; },
      exit: (code) => { exits.push(code); },
      log: quiet,
    });
    assert.equal(ok, true);
    assert.deepEqual(exits, []);
    assert.equal(served, true);
  });
});
