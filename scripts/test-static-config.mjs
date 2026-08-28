import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = JSON.parse(await readFile('site/public/staticwebapp.config.json', 'utf8'));
const built = JSON.parse(await readFile('dist/site/staticwebapp.config.json', 'utf8'));
assert.deepEqual(built, source, 'production build must contain the reviewed Azure policy');
assert.equal('navigationFallback' in source, false, 'unknown routes must not rewrite to home');
assert.equal(source.responseOverrides?.['404']?.rewrite, '/404.html');
const notFound = await readFile('dist/site/404.html', 'utf8');
assert.match(notFound, /<title>Page not found — API Scenario Patch<\/title>/);
assert.match(notFound, /<h1[^>]*>That route was not recorded\.<\/h1>/);
const demo = await readFile('dist/site/demo/index.html', 'utf8');
assert.match(demo, /Demo — sample data, nothing is saved/);
assert.match(demo, /Reset demo/);
assert.match(demo, /Start for real/);
for (const route of ['index.html', 'demo/index.html', 'privacy/index.html', 'terms/index.html', '404.html']) {
  const html = await readFile(`dist/site/${route}`, 'utf8');
  assert.match(html, /rel="canonical"/);
  assert.match(html, /property="og:title"/);
  assert.match(html, /name="twitter:card"/);
  assert.match(html, /apple-touch-icon/);
}

const headers = Object.fromEntries(
  Object.entries(source.globalHeaders).map(([name, value]) => [name.toLowerCase(), value]),
);
assert.match(headers['content-security-policy'], /default-src 'self'/);
assert.match(headers['content-security-policy'], /frame-ancestors 'none'/);
assert.equal(headers['permissions-policy'], 'camera=(), microphone=(), geolocation=()');
assert.equal(headers['referrer-policy'], 'no-referrer');
assert.equal(headers['x-content-type-options'], 'nosniff');

for (const route of ['/assets/*', '/*.webp', '/*.png']) {
  const policy = source.routes.find((entry) => entry.route === route);
  assert.ok(policy, `missing cache route ${route}`);
  assert.equal(policy.headers['Cache-Control'], 'public, max-age=31536000, immutable');
}

console.log('Static response policy, metadata, demo route, and immutable assets verified');
