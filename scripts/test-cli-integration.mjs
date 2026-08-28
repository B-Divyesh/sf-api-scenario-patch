import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const temporary = await mkdtemp(join(tmpdir(), 'asp-e2e-'));
const binary = join(process.cwd(), 'target/debug/asp');

const listen = (server, port = 0) => new Promise((resolve) => {
  server.listen(port, '127.0.0.1', () => resolve(server.address().port));
});
const close = (server) => new Promise((resolve) => server.close(resolve));
const reservePort = async () => {
  const probe = createServer();
  const port = await listen(probe);
  await close(probe);
  return port;
};
const waitForRecorder = async (child) => {
  let stderr = '';
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`proxy did not start: ${stderr}`)), 8000);
    const poll = () => {
      if (stderr.includes('Recording')) {
        clearTimeout(timeout);
        resolve();
      } else if (child.exitCode !== null) {
        clearTimeout(timeout);
        reject(new Error(`proxy exited before start: ${stderr}`));
      } else {
        setTimeout(poll, 20);
      }
    };
    poll();
  });
  return () => stderr;
};
const waitForExit = (child) => new Promise((resolve) => child.on('close', resolve));
const baseConfig = ({ name, upstreamPort, proxyPort }) => `version = 1
name = "${name}"
upstream = "http://127.0.0.1:${upstreamPort}"
listen = "127.0.0.1:${proxyPort}"

[capture]
request_body_paths = []
response_body_paths = []
headers = ["content-type"]
query_parameters = []
max_body_bytes = 262144

[replay]
enabled = false
allowed_hosts = []
`;

const upstream = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/v1/orders') {
    request.resume();
    request.on('end', () => {
      response.writeHead(201, {
        'content-type': 'application/json',
        'set-cookie': 'session=server-secret',
        'x-api-key': 'response-key',
      });
      response.end(JSON.stringify({ id: 42, enabled: true, token: 'server-secret', state: 'created' }));
    });
    return;
  }
  if (request.method === 'POST' && request.url === '/v1/orders/42?api_key=query-secret&page=2&cursor=42') {
    request.resume();
    request.on('end', () => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ state: 'ready' }));
    });
    return;
  }
  if (request.url === '/limit') {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{}');
    }, 150);
    return;
  }
  response.writeHead(404).end();
});
const upstreamPort = await listen(upstream);

// V1/V2: credential-shaped query/header values never persist, configured secrets are
// replaced, and extracted number/boolean values replace exact JSON scalars.
const proxyPort = await reservePort();
const configPath = join(temporary, 'scenario-patch.toml');
const outputPath = join(temporary, 'checkout-flow');
await writeFile(configPath, `version = 1
name = "Checkout flow"
upstream = "http://127.0.0.1:${upstreamPort}"
listen = "127.0.0.1:${proxyPort}"

[capture]
request_body_paths = ["/v1/orders"]
response_body_paths = ["/v1/orders"]
headers = ["content-type", "authorization", "cookie", "set-cookie", "x-api-key", "x-trace"]
query_parameters = ["api_key", "page", "cursor"]
max_body_bytes = 262144

[[secrets]]
name = "CLIENT_SECRET"
environment = "ASP_TEST_SECRET"

[[redactions]]
json_path = "$.payment.card_number"
replacement = "\${REDACTED_CARD}"

[[redactions]]
json_path = "$.token"
replacement = "\${REDACTED_TOKEN}"

[[extractions]]
name = "order_id"
response_path = "/v1/orders"
json_path = "$.id"

[[extractions]]
name = "enabled"
response_path = "/v1/orders"
json_path = "$.enabled"

[[notes]]
path = "/v1/orders"
text = "Review the order handoff."

[replay]
enabled = false
allowed_hosts = []
`);

const child = spawn(binary, [
  'record', '--config', configPath, '--output', outputPath, '--max-exchanges', '2', '--json',
], {
  cwd: process.cwd(),
  env: { ...process.env, ASP_TEST_SECRET: 'configured-secret' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const childStderr = await waitForRecorder(child);

const first = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders`, {
  method: 'POST',
  headers: {
    authorization: 'Bearer client-secret',
    cookie: 'browser=client-secret',
    'content-type': 'application/json',
    'x-api-key': 'request-key',
    'x-trace': 'configured-secret',
  },
  body: JSON.stringify({
    payment: { card_number: '4111111111111111' },
    configured: 'configured-secret',
    item: 'paper',
  }),
});
assert.equal(first.status, 201);
assert.equal((await first.json()).id, 42);

const second = await fetch(
  `http://127.0.0.1:${proxyPort}/v1/orders/42?api_key=query-secret&page=2&cursor=42`,
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ order_id: 42, enabled: true }),
  },
);
assert.equal(second.status, 200);
await second.text();

assert.equal(await waitForExit(child), 0, childStderr());
const yaml = await readFile(`${outputPath}.yml`, 'utf8');
const markdown = await readFile(`${outputPath}.md`, 'utf8');
for (const secret of [
  'client-secret',
  '4111111111111111',
  'server-secret',
  'query-secret',
  'request-key',
  'response-key',
  'configured-secret',
]) {
  assert.equal(yaml.includes(secret), false, `YAML leaked ${secret}`);
  assert.equal(markdown.includes(secret), false, `Markdown leaked ${secret}`);
}
assert.match(yaml, /\$\{REDACTED_CARD\}/);
assert.match(yaml, /api_key=\$\{REDACTED_QUERY\}/);
assert.match(yaml, /page=2/);
assert.match(yaml, /cursor=\$\{order_id\}/);
assert.match(yaml, /id: ['"]?\$\{order_id\}/);
assert.match(yaml, /order_id: ['"]?\$\{order_id\}/);
assert.match(yaml, /enabled: ['"]?\$\{enabled\}/);
assert.match(yaml, /\$\{CLIENT_SECRET\}/);
assert.match(markdown, /Reviewer note: Review the order handoff/);

// V4: a max of one is reserved atomically before forwarding, even under concurrency.
const limitProxyPort = await reservePort();
const limitConfig = join(temporary, 'limit.toml');
const limitOutput = join(temporary, 'limit');
await writeFile(limitConfig, baseConfig({
  name: 'Concurrent limit', upstreamPort, proxyPort: limitProxyPort,
}));
const limited = spawn(binary, [
  'record', '--config', limitConfig, '--output', limitOutput, '--max-exchanges', '1', '--json',
], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let limitedStdout = '';
limited.stdout.on('data', (chunk) => { limitedStdout += chunk; });
const limitedStderr = await waitForRecorder(limited);
const statuses = await Promise.all(
  Array.from({ length: 10 }, async () => {
    const response = await fetch(`http://127.0.0.1:${limitProxyPort}/limit`);
    await response.text();
    return response.status;
  }),
);
assert.deepEqual(statuses.toSorted((a, b) => a - b), [200, 429, 429, 429, 429, 429, 429, 429, 429, 429]);
assert.equal(await waitForExit(limited), 0, limitedStderr());
assert.equal(JSON.parse(limitedStdout.trim()).steps, 1);
assert.equal((await readFile(`${limitOutput}.yml`, 'utf8')).match(/^- number:/gm)?.length, 1);

// V6: failed upstream attempts release their slot and do not create numbering gaps.
const recoveryUpstreamPort = await reservePort();
const recoveryProxyPort = await reservePort();
const recoveryConfig = join(temporary, 'recovery.toml');
const recoveryOutput = join(temporary, 'recovery');
await writeFile(recoveryConfig, baseConfig({
  name: 'Recovery', upstreamPort: recoveryUpstreamPort, proxyPort: recoveryProxyPort,
}));
const recovery = spawn(binary, [
  'record', '--config', recoveryConfig, '--output', recoveryOutput, '--max-exchanges', '1', '--json',
], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
const recoveryStderr = await waitForRecorder(recovery);
const failed = await fetch(`http://127.0.0.1:${recoveryProxyPort}/recover`);
assert.equal(failed.status, 502);
await failed.text();
const recoveryUpstream = createServer((_request, response) => {
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end('{}');
});
await listen(recoveryUpstream, recoveryUpstreamPort);
const recovered = await fetch(`http://127.0.0.1:${recoveryProxyPort}/recover`);
assert.equal(recovered.status, 200);
await recovered.text();
assert.equal(await waitForExit(recovery), 0, recoveryStderr());
const recoveryYaml = await readFile(`${recoveryOutput}.yml`, 'utf8');
assert.match(recoveryYaml, /^- number: 1$/m);
assert.doesNotMatch(recoveryYaml, /^- number: 2$/m);
await close(recoveryUpstream);

// V8: both semantic and Clap parse failures honor --json on stdout.
for (const args of [
  ['record', '--max-exchanges', '0', '--json'],
  ['record', '--max-exchanges', 'not-a-number', '--json'],
]) {
  const failure = spawnSync(binary, args, { cwd: temporary, encoding: 'utf8' });
  assert.equal(failure.status, 2);
  assert.equal(failure.stderr, '');
  const result = JSON.parse(failure.stdout);
  assert.equal(result.ok, false);
  assert.equal(result.kind, 'input');
  assert.equal(typeof result.error, 'string');
}

const replayRefusal = spawnSync(binary, [
  'replay', `${outputPath}.yml`, '--config', configPath,
], { cwd: process.cwd(), encoding: 'utf8' });
assert.equal(replayRefusal.status, 2);
assert.match(replayRefusal.stderr, /replay refused/);

await close(upstream);
console.log('CLI integration: privacy, scalar variables, hard concurrency, recovery, and JSON errors verified');
