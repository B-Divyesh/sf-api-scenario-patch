import { spawnSync } from 'node:child_process';

const id = process.argv[2];
if (!id) throw new Error('Usage: npm run test:claim -- <claim id>');
const browserClaims = new Set(['no-third-party-browser-requests', 'demo-isolated-storage', 'no-account-hosted-workspace', 'site-no-forms-or-analytics', 'offline-reload']);
const command = browserClaims.has(id) ? 'npx' : 'node';
const args = browserClaims.has(id)
  ? ['playwright', 'test', '--grep', `@claim:${id}`]
  : ['--test', '--test-name-pattern', `@claim:${id}`, 'tests/claims.test.mjs'];
if (!browserClaims.has(id)) {
  const build = spawnSync('cargo', ['build', '--bins', '--manifest-path', 'cli/Cargo.toml'], { stdio: 'inherit' });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
const result = spawnSync(command, args, { stdio: 'inherit' });
process.exit(result.status ?? 1);
