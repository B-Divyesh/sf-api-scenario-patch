import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workspace = process.cwd();
const root = await mkdtemp(join(tmpdir(), 'asp-clean-consumer-'));
const source = join(root, 'source');
const installRoot = join(root, 'installed');
const output = join(root, 'demo-output');

execFileSync('git', ['clone', '--no-hardlinks', workspace, source], { stdio: 'pipe' });
const workingChanges = execFileSync('git', ['diff', '--binary', 'HEAD'], { cwd: workspace });
if (workingChanges.length > 0) {
  execFileSync('git', ['apply', '--whitespace=nowarn', '-'], { cwd: source, input: workingChanges });
}
execFileSync('git', ['config', 'user.email', 'consumer-test@example.invalid'], { cwd: source });
execFileSync('git', ['config', 'user.name', 'Clean consumer test'], { cwd: source });
execFileSync('git', ['add', '--all'], { cwd: source });
if (execFileSync('git', ['status', '--porcelain'], { cwd: source, encoding: 'utf8' }).trim()) {
  execFileSync('git', ['commit', '--quiet', '-m', 'consumer fixture'], { cwd: source });
}

execFileSync('cargo', [
  'install', '--git', `file://${source}`, '--locked', '--root', installRoot, '--force', 'api-scenario-patch',
], { cwd: root, stdio: 'pipe' });

const asp = join(installRoot, 'bin', 'asp');
assert.match(execFileSync(asp, ['--version'], { encoding: 'utf8' }), /^asp 0\.1\.0$/m);
const result = JSON.parse(execFileSync(asp, ['demo', '--output-dir', output, '--json'], { cwd: root, encoding: 'utf8' }));
assert.equal(result.ok, true);
assert.match(result.yaml, /checkout-flow\.yml$/);
assert.match(result.markdown, /checkout-flow\.md$/);
console.log('Clean visitor install via cargo install --git produced a working asp demo');
