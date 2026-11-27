const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createRequire } = require('node:module');
const { gzipSync, deflateSync } = require('node:zlib');
const bodyParser = require('body-parser');
const { rawRequest } = require('./fixtures/local-http.cjs');

test('patched parser rejects invalid limits instead of silently disabling enforcement', () => {
  for (const parser of [bodyParser.json, bodyParser.raw, bodyParser.text, bodyParser.urlencoded]) {
    assert.throws(() => parser({ limit: 'invalid-limit', extended: true }), /limit|invalid/i);
  }
});

test('patched parser enforces a small byte limit for ordinary and inflated requests', async () => {
  // Small limit exercises the actual parser boundary without allocating a body
  // near the Framework's 1 GiB middleware limit or changing production options.
  const parse = bodyParser.json({ limit: '1kb' });
  const server = http.createServer((request, response) => parse(request, response, error => {
    response.writeHead(error?.status || 200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify(error ? { type: error.type } : request.body));
  }));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    for (const [encoding, encode] of [['identity', bytes => bytes], ['gzip', gzipSync], ['deflate', deflateSync]]) {
      const options = { 'Content-Encoding': encoding };
      const data = { message: 'Unicode é\r\nexact\rtext' };
      const accepted = await rawRequest(port, '/', encode(Buffer.from(JSON.stringify(data))), options);
      assert.equal(accepted.status, 200); assert.deepEqual(accepted.body, data);
      const rejected = await rawRequest(port, '/', encode(Buffer.from(JSON.stringify({ text: 'x'.repeat(1025) }))), options);
      assert.equal(rejected.status, 413); assert.equal(rejected.body.type, 'entity.too.large');
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
});

test('CloudEvents scoped UUID override preserves its CommonJS v4 generation and transport APIs', () => {
  const { CloudEvent, HTTP } = require('cloudevents');
  const parentRequire = createRequire(require.resolve('cloudevents'));
  const uuid = parentRequire('uuid');
  assert.equal(parentRequire('uuid/package.json').version, '11.1.1');
  const event = new CloudEvent({ source: '/local-security-test', type: 'local.test', data: { exact: 'é\r\n' } });
  assert.equal(uuid.validate(event.id), true); assert.equal(uuid.version(event.id), 4);
  assert.equal(event.validate(), true);
  const clone = event.cloneWith({ subject: 'cloned' });
  assert.equal(clone.id, event.id); assert.deepEqual(clone.data, event.data);
  const message = HTTP.binary(clone);
  const restored = HTTP.toEvent({ headers: message.headers, body: message.body });
  assert.equal(restored.id, event.id); assert.deepEqual(restored.data, event.data);
});

test('scoped patched UUID checks caller buffer bounds for affected v3/v5/v6 functions', () => {
  const parentRequire = createRequire(require.resolve('cloudevents'));
  const { v3, v5, v6 } = parentRequire('uuid');
  for (const generate of [() => v3('local', v3.DNS, new Uint8Array(8), 0),
    () => v5('local', v5.DNS, new Uint8Array(8), 0),
    () => v6({}, new Uint8Array(8), 0)]) assert.throws(generate, RangeError);
});

test('patched proxy-addr does not trust arbitrary IPv4 through a mapped IPv6 subnet', () => {
  const proxyaddr = require('proxy-addr');
  const trust = proxyaddr.compile('::ffff:10.0.0.0/8');
  assert.equal(trust('203.0.113.10', 0), false);
  assert.equal(proxyaddr.compile('10.0.0.0/8')('10.1.2.3', 0), true);
});
