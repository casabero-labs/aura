import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import type { Sql } from '../src/db.js';
import { tokensMatch } from '../src/auth.js';

const TOKEN = 'test-token-0123456789';

/** Fake tagged-template `sql` that records queries and returns canned rows. */
function fakeDb(rows: unknown[] = []) {
  const calls: string[] = [];
  const sql = ((strings: TemplateStringsArray) => {
    calls.push(strings.join('?'));
    return Promise.resolve(rows);
  }) as unknown as Sql;
  return { db: () => sql, calls };
}

function appWith(token: string | undefined, rows: unknown[] = []) {
  const { db, calls } = fakeDb(rows);
  return { app: createApp({ db, getToken: () => token, log: false }), calls };
}

const protectedRoutes: Array<[string, string, unknown?]> = [
  ['GET', '/api/settings'],
  ['GET', '/api/settings/ai_config'],
  ['POST', '/api/settings', { key: 'ai_config', value: { model: 'x' } }],
  ['DELETE', '/api/settings/ai_config'],
  ['GET', '/api/sessions'],
  ['GET', '/api/sessions/00000000-0000-0000-0000-000000000000'],
  ['POST', '/api/sessions', { dataset_fingerprint: 'abc' }],
  ['PATCH', '/api/sessions/00000000-0000-0000-0000-000000000000', { score: 1 }],
  ['DELETE', '/api/sessions/00000000-0000-0000-0000-000000000000'],
  ['GET', '/api/benchmarks'],
  ['POST', '/api/benchmarks', { provider: 'p', provider_type: 't', model: 'm' }],
  ['PATCH', '/api/benchmarks/00000000-0000-0000-0000-000000000000', { status: 'error' }],
  ['DELETE', '/api/benchmarks/00000000-0000-0000-0000-000000000000'],
];

function req(method: string, body?: unknown, headers: Record<string, string> = {}): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  };
}

describe('health', () => {
  it('is public even when the token is unset', async () => {
    const { app } = appWith(undefined);
    const res = await app.request('/health');
    assert.equal(res.status, 200);
    assert.equal((await res.json()).status, 'ok');
  });

  it('is public when a token is configured (no header needed)', async () => {
    const { app } = appWith(TOKEN);
    assert.equal((await app.request('/health')).status, 200);
  });
});

describe('auth on /api routes', () => {
  for (const [method, path, body] of protectedRoutes) {
    it(`${method} ${path} -> 401 without token, never touching the db`, async () => {
      const { app, calls } = appWith(TOKEN);
      const res = await app.request(path, req(method, body));
      assert.equal(res.status, 401);
      assert.equal(res.headers.get('WWW-Authenticate'), 'Bearer');
      assert.equal(calls.length, 0);
    });

    it(`${method} ${path} -> 503 when AURA_API_TOKEN is unset (fail closed)`, async () => {
      const { app, calls } = appWith(undefined);
      const res = await app.request(path, req(method, body, { Authorization: `Bearer ${TOKEN}` }));
      assert.equal(res.status, 503);
      assert.equal(calls.length, 0);
    });
  }

  it('treats an empty AURA_API_TOKEN as unset (503)', async () => {
    const { app } = appWith('');
    const res = await app.request('/api/settings', req('GET', undefined, { Authorization: 'Bearer ' }));
    assert.equal(res.status, 503);
  });

  it('rejects a wrong token with 401', async () => {
    const { app, calls } = appWith(TOKEN);
    const res = await app.request('/api/settings', req('GET', undefined, { Authorization: 'Bearer nope' }));
    assert.equal(res.status, 401);
    assert.equal(calls.length, 0);
  });

  it('rejects a non-Bearer scheme with 401', async () => {
    const { app } = appWith(TOKEN);
    const res = await app.request('/api/settings', req('GET', undefined, { Authorization: `Basic ${TOKEN}` }));
    assert.equal(res.status, 401);
  });

  it('GET /api/settings -> 200 with the correct token', async () => {
    const rows = [{ key: 'k', value: {}, updated_at: 'now' }];
    const { app, calls } = appWith(TOKEN, rows);
    const res = await app.request('/api/settings', req('GET', undefined, { Authorization: `Bearer ${TOKEN}` }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { settings: rows });
    assert.equal(calls.length, 1);
  });

  it('DELETE /api/sessions/:id -> 200 with the correct token', async () => {
    const { app } = appWith(TOKEN);
    const id = '00000000-0000-0000-0000-000000000000';
    const res = await app.request(`/api/sessions/${id}`, req('DELETE', undefined, { Authorization: `bearer ${TOKEN}` }));
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { deleted: id });
  });

  it('CORS preflight from an allowed origin is not blocked by auth', async () => {
    const { app } = appWith(TOKEN);
    const res = await app.request('/api/settings', {
      method: 'OPTIONS',
      headers: {
        Origin: 'https://aura.casabero.com',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    assert.equal(res.status, 204);
    assert.equal(res.headers.get('Access-Control-Allow-Origin'), 'https://aura.casabero.com');
  });

  it('CORS does not allow unknown origins', async () => {
    const { app } = appWith(TOKEN);
    const res = await app.request('/health', { headers: { Origin: 'https://evil.example' } });
    assert.notEqual(res.headers.get('Access-Control-Allow-Origin'), 'https://evil.example');
  });
});

describe('tokensMatch', () => {
  it('compares tokens of different lengths without throwing', () => {
    assert.equal(tokensMatch('abc', 'abc'), true);
    assert.equal(tokensMatch('abc', 'abcd'), false);
    assert.equal(tokensMatch('abc', ''), false);
  });
});
