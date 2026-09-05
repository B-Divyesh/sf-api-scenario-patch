import assert from 'node:assert/strict';
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const binary = join(process.cwd(), 'target/debug/asp');
const run = (args, options = {}) => execFileSync(binary, args, { encoding: 'utf8', ...options });
const runAsync = (args, options = {}) => new Promise((resolve, reject) => {
  const child = spawn(binary, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.on('error', reject);
  child.on('close', (status) => resolve({ status, stdout, stderr }));
});

const listen = (server, port = 0) => new Promise((resolve) => {
  server.listen(port, '127.0.0.1', () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});
const reservePort = async () => {
  const server = createServer();
  const port = await listen(server);
  await close(server);
  return port;
};
const waitForExit = (child) => child.exitCode !== null
  ? Promise.resolve(child.exitCode)
  : new Promise((resolve) => child.on('close', resolve));
const waitForRecorder = async (child) => {
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`recorder did not start: ${stderr}`)), 8_000);
    const poll = () => {
      if (stderr.includes('Recording')) {
        clearTimeout(timeout);
        resolve();
      } else if (child.exitCode !== null) {
        clearTimeout(timeout);
        reject(new Error(`recorder exited before start: ${stderr}`));
      } else {
        setTimeout(poll, 20);
      }
    };
    poll();
  });
  return () => stderr;
};
const configFor = ({
  name = 'Claim flow',
  upstreamPort,
  proxyPort,
  requestBodies = [],
  responseBodies = [],
  headers = ['content-type'],
  query = [],
  rules = '',
}) => `version = 1
name = "${name}"
upstream = "http://127.0.0.1:${upstreamPort}"
listen = "127.0.0.1:${proxyPort}"

[capture]
request_body_paths = [${requestBodies.map((path) => `"${path}"`).join(', ')}]
response_body_paths = [${responseBodies.map((path) => `"${path}"`).join(', ')}]
headers = [${headers.map((header) => `"${header}"`).join(', ')}]
query_parameters = [${query.map((parameter) => `"${parameter}"`).join(', ')}]
max_body_bytes = 262144

${rules}

[replay]
enabled = false
allowed_hosts = []
`;
const startRecorder = async ({ config, output, exchanges, env = process.env }) => {
  const child = spawn(binary, [
    'record', '--config', config, '--output', output, '--max-exchanges', String(exchanges), '--json',
  ], { cwd: process.cwd(), env, stdio: ['ignore', 'pipe', 'pipe'] });
  const stderr = await waitForRecorder(child);
  return { child, stderr };
};
const artifact = async (output) => Promise.all([
  readFile(`${output}.yml`, 'utf8'),
  readFile(`${output}.md`, 'utf8'),
]);
const assertNoSecret = (files, secret) => {
  for (const file of files) assert.equal(file.includes(secret), false, `output leaked ${secret}`);
};

test('@claim:demo-command-output asp demo writes bundled Markdown and YAML in a new temporary directory', async () => {
  const output = await mkdtemp(join(tmpdir(), 'asp-claim-demo-parent-')) + '-output';
  const result = JSON.parse(run(['demo', '--output-dir', output, '--json']));
  assert.equal(result.ok, true);
  assert.equal(result.demo, true);
  const [yaml, markdown] = await Promise.all([readFile(result.yaml, 'utf8'), readFile(result.markdown, 'utf8')]);
  assert.match(yaml, /\$\{REDACTED_CARD\}/);
  assert.match(markdown, /\$\{order_id\}/);
  assert.equal(yaml.includes('4111111111111111'), false);
  assert.deepEqual((await readdir(output)).sort(), ['checkout-flow.md', 'checkout-flow.yml']);
});

test('@claim:demo-no-network asp demo makes no connection when HTTP proxy monitors are present', async () => {
  let proxyRequests = 0;
  const monitor = createServer((_request, response) => {
    proxyRequests += 1;
    response.writeHead(502).end();
  });
  const monitorPort = await listen(monitor);
  try {
    const directory = await mkdtemp(join(tmpdir(), 'asp-claim-demo-network-'));
    const output = join(directory, 'sample-output');
    const result = JSON.parse(run(['demo', '--output-dir', output, '--json'], {
      cwd: directory,
      env: {
        ...process.env,
        HTTP_PROXY: `http://127.0.0.1:${monitorPort}`,
        HTTPS_PROXY: `http://127.0.0.1:${monitorPort}`,
        ALL_PROXY: `http://127.0.0.1:${monitorPort}`,
        NO_PROXY: '',
      },
    }));
    assert.equal(result.ok, true);
    assert.equal(proxyRequests, 0, 'the demo must not contact a proxy or API');
    assert.deepEqual((await readdir(directory)).sort(), ['sample-output']);
    assert.deepEqual((await readdir(output)).sort(), ['checkout-flow.md', 'checkout-flow.yml']);
  } finally {
    await close(monitor);
  }
});

test('@claim:default-deny-capture a fresh asp init policy omits request and response bodies from both files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-default-deny-'));
  const upstream = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(201, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ response_secret: 'response-should-not-be-written' }));
    });
  });
  const upstreamPort = await listen(upstream);
  try {
    const proxyPort = await reservePort();
    const config = join(directory, 'scenario-patch.toml');
    run(['init', '--config', config, '--json']);
    const initialized = await readFile(config, 'utf8');
    await writeFile(config, initialized
      .replace('https://api.example.com', `http://127.0.0.1:${upstreamPort}`)
      .replace('127.0.0.1:4317', `127.0.0.1:${proxyPort}`));
    const output = join(directory, 'default-deny');
    const recorder = await startRecorder({ config, output, exchanges: 1 });
    assert.equal(existsSync(`${output}.yml`), false);
    const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ request_secret: 'request-should-not-be-written' }),
    });
    assert.equal(response.status, 201);
    await response.text();
    assert.equal(await waitForExit(recorder.child), 0, recorder.stderr());
    const files = await artifact(output);
    assertNoSecret(files, 'request-should-not-be-written');
    assertNoSecret(files, 'response-should-not-be-written');
    for (const file of files) assert.match(file, /path not allowlisted/);
  } finally {
    await close(upstream);
  }
});

test('@claim:mask-before-files JSON field rules mask a recorded secret in both output files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-mask-'));
  const upstream = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ card_number: 'response-card-secret' }));
    });
  });
  const upstreamPort = await listen(upstream);
  try {
    const proxyPort = await reservePort();
    const config = join(directory, 'mask.toml');
    await writeFile(config, configFor({
      upstreamPort, proxyPort, requestBodies: ['/cards'], responseBodies: ['/cards'],
      rules: `[[redactions]]\njson_path = "$.card_number"\nreplacement = "\${REDACTED_CARD}"`,
    }));
    const output = join(directory, 'masked');
    const recorder = await startRecorder({ config, output, exchanges: 1 });
    const response = await fetch(`http://127.0.0.1:${proxyPort}/cards`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ card_number: 'request-card-secret' }),
    });
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(await waitForExit(recorder.child), 0, recorder.stderr());
    const files = await artifact(output);
    assertNoSecret(files, 'request-card-secret');
    assertNoSecret(files, 'response-card-secret');
    for (const file of files) assert.match(file, /\$\{REDACTED_CARD\}/);
  } finally {
    await close(upstream);
  }
});

test('@claim:local-only-listener asp refuses a public listener before recording starts', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-listener-'));
  const config = join(directory, 'public.toml');
  await writeFile(config, 'version = 1\nname = "x"\nupstream = "https://api.example.test"\nlisten = "0.0.0.0:4317"\n[capture]\nmax_body_bytes = 1\n');
  const result = spawnSync(binary, ['check', '--config', config, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 2);
  const error = JSON.parse(result.stdout);
  assert.equal(error.kind, 'input');
  assert.match(error.error, /loopback/);
});

test('@claim:deterministic-demo-output the same bundled sample creates byte-identical files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-repeat-'));
  const one = JSON.parse(run(['demo', '--output-dir', join(directory, 'one'), '--json']));
  const two = JSON.parse(run(['demo', '--output-dir', join(directory, 'two'), '--json']));
  assert.equal(await readFile(one.yaml, 'utf8'), await readFile(two.yaml, 'utf8'));
  assert.equal(await readFile(one.markdown, 'utf8'), await readFile(two.markdown, 'utf8'));
});

test('@claim:record-flow-output a two-step proxy recording writes ordered requests, masked values, saved values, and notes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-record-flow-'));
  const upstream = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      if (request.url === '/v1/orders') {
        response.writeHead(201, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ id: 'order-903', card_number: 'response-card-secret' }));
      } else {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ state: 'ready' }));
      }
    });
  });
  const upstreamPort = await listen(upstream);
  try {
    const proxyPort = await reservePort();
    const config = join(directory, 'flow.toml');
    await writeFile(config, configFor({
      name: 'Review flow', upstreamPort, proxyPort,
      requestBodies: ['/v1/orders'], responseBodies: ['/v1/orders'],
      headers: ['content-type', 'x-order-reference'],
      rules: `[[redactions]]\njson_path = "$.card_number"\nreplacement = "\${REDACTED_CARD}"\n\n[[extractions]]\nname = "order_id"\nresponse_path = "/v1/orders"\njson_path = "$.id"\n\n[[notes]]\npath = "/v1/orders"\ntext = "Review the retry before merging."`,
    }));
    const output = join(directory, 'review-flow');
    const recorder = await startRecorder({ config, output, exchanges: 2 });
    const first = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ card_number: 'request-card-secret', item: 'field-notebook' }),
    });
    assert.equal(first.status, 201);
    await first.text();
    const second = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders/order-903`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-order-reference': 'order-903' },
      body: JSON.stringify({ order_id: 'order-903' }),
    });
    assert.equal(second.status, 200);
    await second.text();
    assert.equal(await waitForExit(recorder.child), 0, recorder.stderr());
    const [yaml, markdown] = await artifact(output);
    assert.match(yaml, /- number: 1/);
    assert.match(yaml, /- number: 2/);
    assert.match(yaml, /\$\{REDACTED_CARD\}/);
    assert.match(yaml, /\$\{order_id\}/);
    assert.match(markdown, /Reviewer note: Review the retry before merging/);
    assert.match(markdown, /## 2\. `POST` `\/v1\/orders\/\$\{order_id\}`/);
    assertNoSecret([yaml, markdown], 'request-card-secret');
    assertNoSecret([yaml, markdown], 'response-card-secret');
  } finally {
    await close(upstream);
  }
});

test('@claim:sensitive-header-query-exclusion sensitive headers and secret-named query values stay out of both files', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-sensitive-'));
  const upstream = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, {
        'content-type': 'application/json', authorization: 'Bearer response-auth-secret',
        'set-cookie': 'session=response-cookie-secret', 'x-api-key': 'response-api-key-secret',
      });
      response.end(JSON.stringify({ state: 'ok' }));
    });
  });
  const upstreamPort = await listen(upstream);
  try {
    const proxyPort = await reservePort();
    const config = join(directory, 'sensitive.toml');
    await writeFile(config, configFor({
      upstreamPort, proxyPort,
      headers: ['content-type', 'authorization', 'cookie', 'x-api-key', 'x-trace'],
      query: ['page', 'password', 'secret', 'signature', 'token'],
    }));
    const output = join(directory, 'sensitive');
    const recorder = await startRecorder({ config, output, exchanges: 1 });
    const response = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders?page=3&password=password-secret&secret=secret-value&signature=signature-secret&token=token-secret`, {
      headers: {
        authorization: 'Bearer request-auth-secret', cookie: 'session=request-cookie-secret',
        'x-api-key': 'request-api-key-secret', 'x-trace': 'safe-trace',
      },
    });
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(await waitForExit(recorder.child), 0, recorder.stderr());
    const files = await artifact(output);
    for (const secret of [
      'request-auth-secret', 'request-cookie-secret', 'request-api-key-secret',
      'response-auth-secret', 'response-cookie-secret', 'response-api-key-secret',
      'password-secret', 'secret-value', 'signature-secret', 'token-secret',
    ]) assertNoSecret(files, secret);
    for (const file of files) {
      assert.match(file, /page=3/);
      assert.match(file, /\$\{REDACTED_QUERY\}/);
      assert.match(file, /safe-trace/);
    }
  } finally {
    await close(upstream);
  }
});

test('@claim:saved-values-substitute a saved response value replaces a later path, header, and body value', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-values-'));
  const upstream = createServer((request, response) => {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(request.url === '/v1/orders' ? JSON.stringify({ id: 'order-17' }) : JSON.stringify({ state: 'done' }));
    });
  });
  const upstreamPort = await listen(upstream);
  try {
    const proxyPort = await reservePort();
    const config = join(directory, 'values.toml');
    await writeFile(config, configFor({
      upstreamPort, proxyPort, requestBodies: ['/v1/orders'], responseBodies: ['/v1/orders'],
      headers: ['content-type', 'x-order-reference'],
      rules: `[[extractions]]\nname = "order_id"\nresponse_path = "/v1/orders"\njson_path = "$.id"`,
    }));
    const output = join(directory, 'values');
    const recorder = await startRecorder({ config, output, exchanges: 2 });
    const first = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders`, { method: 'POST', body: '{}' });
    assert.equal(first.status, 200);
    await first.text();
    const second = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders/order-17`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-order-reference': 'order-17' },
      body: JSON.stringify({ order_id: 'order-17' }),
    });
    assert.equal(second.status, 200);
    await second.text();
    assert.equal(await waitForExit(recorder.child), 0, recorder.stderr());
    const files = await artifact(output);
    for (const file of files) {
      assert.match(file, /\/v1\/orders\/\$\{order_id\}/);
      assert.match(file, /x-order-reference: \$\{order_id\}/);
      assert.match(file, /order_id.{0,4}\$\{order_id\}/);
      assert.equal(file.includes('order-17'), false);
    }
  } finally {
    await close(upstream);
  }
});

test('@claim:configured-upstream-only recording bypasses environment proxies and reaches only the configured upstream', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-upstream-'));
  let upstreamRequests = 0;
  let proxyRequests = 0;
  const upstream = createServer((request, response) => {
    upstreamRequests += 1;
    request.resume();
    request.on('end', () => response.writeHead(200).end('ok'));
  });
  const monitor = createServer((_request, response) => {
    proxyRequests += 1;
    response.writeHead(502).end();
  });
  const upstreamPort = await listen(upstream);
  const monitorPort = await listen(monitor);
  try {
    const proxyPort = await reservePort();
    const config = join(directory, 'upstream.toml');
    await writeFile(config, configFor({ upstreamPort, proxyPort }));
    const output = join(directory, 'upstream');
    const recorder = await startRecorder({
      config, output, exchanges: 1,
      env: {
        ...process.env,
        HTTP_PROXY: `http://127.0.0.1:${monitorPort}`,
        HTTPS_PROXY: `http://127.0.0.1:${monitorPort}`,
        ALL_PROXY: `http://127.0.0.1:${monitorPort}`,
        NO_PROXY: '',
      },
    });
    const response = await fetch(`http://127.0.0.1:${proxyPort}/configured-target`);
    assert.equal(response.status, 200);
    await response.text();
    assert.equal(await waitForExit(recorder.child), 0, recorder.stderr());
    assert.equal(upstreamRequests, 1);
    assert.equal(proxyRequests, 0, 'recording must not use an environment-configured proxy');
  } finally {
    await close(upstream);
    await close(monitor);
  }
});

test('@claim:write-after-recording output files appear at the chosen path only after recording ends', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-write-timing-'));
  const upstream = createServer((request, response) => {
    request.resume();
    request.on('end', () => response.writeHead(204).end());
  });
  const upstreamPort = await listen(upstream);
  try {
    const proxyPort = await reservePort();
    const config = join(directory, 'timing.toml');
    await writeFile(config, configFor({ upstreamPort, proxyPort }));
    const output = join(directory, 'chosen', 'scenario');
    const recorder = await startRecorder({ config, output, exchanges: 1 });
    assert.equal(existsSync(`${output}.yml`), false);
    assert.equal(existsSync(`${output}.md`), false);
    const response = await fetch(`http://127.0.0.1:${proxyPort}/complete`);
    assert.equal(response.status, 204);
    assert.equal(await waitForExit(recorder.child), 0, recorder.stderr());
    assert.equal(existsSync(`${output}.yml`), true);
    assert.equal(existsSync(`${output}.md`), true);
  } finally {
    await close(upstream);
  }
});

test('@claim:replay-double-opt-in replay sends traffic only when config and command line both opt in', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-replay-'));
  let received = 0;
  const upstream = createServer((request, response) => {
    received += 1;
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ id: 'replayed-order' }));
    });
  });
  const upstreamPort = await listen(upstream);
  try {
    const scenario = join(directory, 'replay.yml');
    await writeFile(scenario, 'version: 1\nname: Replay claim\ngenerated_by: claim test\nreplay_enabled: false\nvariables: []\nsteps:\n- number: 1\n  request:\n    method: POST\n    path: /ping\n    headers: {}\n    body:\n      state: captured\n      value: {}\n  response:\n    status: 200\n    headers: {}\n    body:\n      state: captured\n      value: {}\n  extracted: []\n');
    const enabled = join(directory, 'enabled.toml');
    const disabled = join(directory, 'disabled.toml');
    const replayConfig = (isEnabled) => `version = 1\nname = "Replay claim"\nupstream = "http://127.0.0.1:${upstreamPort}"\nlisten = "127.0.0.1:4317"\n[capture]\nmax_body_bytes = 1\n[replay]\nenabled = ${isEnabled}\nallowed_hosts = ["127.0.0.1"]\n`;
    await writeFile(enabled, replayConfig(true));
    await writeFile(disabled, replayConfig(false));
    const missingFlag = spawnSync(binary, ['replay', scenario, '--config', enabled, '--json'], { encoding: 'utf8' });
    assert.equal(missingFlag.status, 2);
    assert.match(JSON.parse(missingFlag.stdout).error, /pass --confirm/);
    assert.equal(received, 0);
    const disabledConfig = spawnSync(binary, ['replay', scenario, '--config', disabled, '--confirm', '--json'], { encoding: 'utf8' });
    assert.equal(disabledConfig.status, 2);
    assert.match(JSON.parse(disabledConfig.stdout).error, /replay.enabled = true/);
    assert.equal(received, 0);
    const bothOptedIn = await runAsync(['replay', scenario, '--config', enabled, '--confirm', '--json']);
    assert.equal(bothOptedIn.status, 0, bothOptedIn.stderr);
    assert.equal(JSON.parse(bothOptedIn.stdout).ok, true);
    assert.equal(received, 1);
  } finally {
    await close(upstream);
  }
});
