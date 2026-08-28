import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

const temporary = await mkdtemp(join(tmpdir(), 'asp-e2e-'));
const upstream = createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/v1/orders') {
    request.resume();
    request.on('end', () => {
      response.writeHead(201, { 'content-type': 'application/json', 'set-cookie': 'session=server-secret' });
      response.end(JSON.stringify({ id: 'ord_private_42', token: 'server-secret', state: 'created' }));
    });
    return;
  }
  if (request.method === 'GET' && request.url === '/v1/orders/ord_private_42') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ state: 'ready' }));
    return;
  }
  response.writeHead(404).end();
});
await new Promise((resolve) => upstream.listen(0, '127.0.0.1', resolve));
const upstreamPort = upstream.address().port;

const probe = createServer();
await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
const proxyPort = probe.address().port;
await new Promise((resolve) => probe.close(resolve));

const configPath = join(temporary, 'scenario-patch.toml');
const outputPath = join(temporary, 'checkout-flow');
await writeFile(configPath, `version = 1
name = "Checkout flow"
upstream = "http://127.0.0.1:${upstreamPort}"
listen = "127.0.0.1:${proxyPort}"

[capture]
request_body_paths = ["/v1/orders"]
response_body_paths = ["/v1/orders"]
headers = ["content-type", "authorization", "cookie", "set-cookie"]
max_body_bytes = 262144

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

[[notes]]
path = "/v1/orders"
text = "Review the order handoff."

[replay]
enabled = false
allowed_hosts = []
`);

const child = spawn('cli/target/debug/asp', [
  'record', '--config', configPath, '--output', outputPath, '--max-exchanges', '2', '--json'
], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
child.stderr.on('data', (chunk) => { stderr += chunk; });
await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`proxy did not start: ${stderr}`)), 8000);
  const poll = () => {
    if (stderr.includes('Recording')) { clearTimeout(timeout); resolve(); }
    else setTimeout(poll, 20);
  };
  poll();
});

const first = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders`, {
  method: 'POST',
  headers: {
    authorization: 'Bearer client-secret',
    cookie: 'browser=client-secret',
    'content-type': 'application/json'
  },
  body: JSON.stringify({ payment: { card_number: '4111111111111111' }, item: 'paper' })
});
assert.equal(first.status, 201);
assert.equal((await first.json()).id, 'ord_private_42');

const second = await fetch(`http://127.0.0.1:${proxyPort}/v1/orders/ord_private_42`);
assert.equal(second.status, 200);
await second.text();

const exitCode = await new Promise((resolve) => child.on('close', resolve));
await new Promise((resolve) => upstream.close(resolve));
assert.equal(exitCode, 0, stderr);

const yaml = await readFile(`${outputPath}.yml`, 'utf8');
const markdown = await readFile(`${outputPath}.md`, 'utf8');
for (const secret of ['client-secret', '4111111111111111', 'server-secret', 'ord_private_42']) {
  assert.equal(yaml.includes(secret), false, `YAML leaked ${secret}`);
  assert.equal(markdown.includes(secret), false, `Markdown leaked ${secret}`);
}
assert.match(yaml, /\$\{REDACTED_CARD\}/);
assert.match(yaml, /\/v1\/orders\/\$\{order_id\}/);
assert.match(markdown, /Reviewer note: Review the order handoff/);
const replayRefusal = spawnSync('cli/target/debug/asp', [
  'replay', `${outputPath}.yml`, '--config', configPath
], { cwd: process.cwd(), encoding: 'utf8' });
assert.equal(replayRefusal.status, 2);
assert.match(replayRefusal.stderr, /replay refused/);
console.log('CLI integration: 2 exchanges captured, secrets absent, variable reused');
