import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('site/public/staticwebapp.config.json', 'utf8'));
const built = JSON.parse(await readFile('dist/site/staticwebapp.config.json', 'utf8'));
assert.deepEqual(built, source, 'production build must contain the reviewed Azure policy');

const headers = Object.fromEntries(
  Object.entries(source.globalHeaders).map(([name, value]) => [name.toLowerCase(), value]),
);
assert.match(headers['content-security-policy'], /default-src 'self'/);
assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
assert.equal(headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
assert.equal(headers['referrer-policy'], 'no-referrer');
assert.equal(headers['x-content-type-options'], 'nosniff');

for (const route of ['/assets/*', '/*.webp']) {
  const policy = source.routes.find((entry) => entry.route === route);
  assert.ok(policy, `missing cache route ${route}`);
  assert.equal(policy.headers['Cache-Control'], 'public, max-age=31536000, immutable');
}

console.log('Static response policy: Azure config, security headers, and immutable assets verified');
