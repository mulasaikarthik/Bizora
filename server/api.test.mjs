// Run with: node --test server/   (uses a temp DB via DB_PATH; never touches server/data/db.json)
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bizora-test-'));
process.env.DB_PATH = path.join(tmpDir, 'db.json');

const { createServer } = await import('./index.mjs');

let server;
let base;

before(async () => {
  server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await fs.rm(tmpDir, { recursive: true, force: true });
});

async function call(method, route, body) {
  const init = { method, headers: {} };
  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = typeof body === 'string' ? body : JSON.stringify(body);
  }
  const res = await fetch(base + route, init);
  const json = await res.json();
  return { status: res.status, body: json };
}

test('health responds ok', async () => {
  const { status, body } = await call('GET', '/api/health');
  assert.equal(status, 200);
  assert.equal(body.status, 'ok');
});

test('GET /api/state returns seeded clients', async () => {
  const { status, body } = await call('GET', '/api/state');
  assert.equal(status, 200);
  assert.ok(Array.isArray(body.clients));
  assert.ok(body.clients.length >= 1);
  assert.ok(Array.isArray(body.invoices));
  assert.ok(typeof body.invoices[0].effectiveStatus === 'string');
});

test('POST invalid client returns 422 with fields', async () => {
  const { status, body } = await call('POST', '/api/clients', { name: 'X' });
  assert.equal(status, 422);
  assert.equal(body.code, 'INVALID_INPUT');
  assert.ok(body.fields && body.fields.name);
});

test('malformed JSON returns 400 BAD_JSON', async () => {
  const { status, body } = await call('POST', '/api/clients', '{not json');
  assert.equal(status, 400);
  assert.equal(body.code, 'BAD_JSON');
});

test('unknown route returns 404 NOT_FOUND', async () => {
  const { status, body } = await call('GET', '/api/nope');
  assert.equal(status, 404);
  assert.equal(body.code, 'NOT_FOUND');
});

test('forecast rejects a bad horizon with 400', async () => {
  const { status } = await call('GET', '/api/forecast?horizon=45');
  assert.equal(status, 400);
});

test('overpayment is rejected with 422 EXCEEDS_BALANCE', async () => {
  const { body: state } = await call('GET', '/api/state');
  const target = state.invoices.find((inv) => inv.effectiveStatus === 'Sent');
  assert.ok(target, 'seed data has a sent invoice');
  const { status, body } = await call('POST', `/api/invoices/${target.id}/payments`, {
    amount: target.balance + 1000,
    method: 'Cash',
    date: target.issueDate,
  });
  assert.equal(status, 422);
  assert.equal(body.code, 'EXCEEDS_BALANCE');
});
