import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

const binary = join(process.cwd(), 'target/debug/asp');
const run = (args) => execFileSync(binary, args, { encoding: 'utf8' });

test('@claim:demo-command-output asp demo writes bundled Markdown and YAML in an isolated directory', async () => {
  const outputDir = await mkdtemp(join(tmpdir(), 'asp-claim-demo-parent-')) + '-output';
  const result = JSON.parse(run(['demo', '--output-dir', outputDir, '--json']));
  assert.equal(result.ok, true);
  assert.equal(result.demo, true);
  const [yaml, markdown] = await Promise.all([readFile(result.yaml, 'utf8'), readFile(result.markdown, 'utf8')]);
  assert.match(yaml, /\$\{REDACTED_CARD\}/);
  assert.match(markdown, /\$\{order_id\}/);
  assert.equal(yaml.includes('4111111111111111'), false);
});

test('@claim:default-deny-capture asp init leaves request and response bodies denied', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-default-'));
  const config = join(directory, 'scenario-patch.toml');
  run(['init', '--config', config]);
  const text = await readFile(config, 'utf8');
  assert.match(text, /^request_body_paths = \[\]$/m);
  assert.match(text, /^response_body_paths = \[\]$/m);
});

test('@claim:redact-before-files redaction transforms JSON before it is serialized', () => {
  const output = execFileSync('cargo', ['test', '--manifest-path', 'cli/Cargo.toml', 'redacts_wildcards_before_serialization'], { encoding: 'utf8' });
  assert.match(output, /test result: ok/);
});

test('@claim:local-only-listener public listener configuration is refused', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-loopback-'));
  const config = join(directory, 'public.toml');
  await writeFile(config, 'version = 1\nname = "x"\nupstream = "https://api.example.test"\nlisten = "0.0.0.0:4317"\n[capture]\nmax_body_bytes = 1\n');
  let failed = false;
  try { run(['check', '--config', config]); } catch (error) { failed = String(error.stderr).includes('loopback'); }
  assert.equal(failed, true);
});

test('@claim:deterministic-demo-output same sample input creates the same files', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'asp-claim-repeat-'));
  const first = join(parent, 'one'); const second = join(parent, 'two');
  const one = JSON.parse(run(['demo', '--output-dir', first, '--json']));
  const two = JSON.parse(run(['demo', '--output-dir', second, '--json']));
  assert.equal(await readFile(one.yaml, 'utf8'), await readFile(two.yaml, 'utf8'));
  assert.equal(await readFile(one.markdown, 'utf8'), await readFile(two.markdown, 'utf8'));
});

test('@claim:replay-double-opt-in replay refuses without the command-line confirmation', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'asp-claim-replay-'));
  const config = join(directory, 'scenario-patch.toml');
  await writeFile(config, 'version = 1\nname = "x"\nupstream = "https://api.example.test"\nlisten = "127.0.0.1:4317"\n[capture]\nmax_body_bytes = 1\n[replay]\nenabled = false\n');
  let failed = false;
  try { run(['replay', 'missing.yml', '--config', config]); } catch (error) { failed = String(error.stderr).includes('pass --confirm'); }
  assert.equal(failed, true);
});
