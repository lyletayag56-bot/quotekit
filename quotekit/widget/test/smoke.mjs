// Smoke test for the BUILT bundle (dist/widget.js): mounts a config in
// jsdom, checks live computation, and walks the gated lead flow.
// Run via `npm test` (builds first).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const bundlePath = fileURLToPath(new URL('../../dist/widget.js', import.meta.url));
const bundle = readFileSync(bundlePath, 'utf8');

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://customer-site.example/pricing',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
});
const { window } = dom;
window.fetch = async () => {
  throw new Error('network must not be touched in inline/demo mode');
};

window.eval(bundle);
assert.ok(window.QuoteKit, 'window.QuoteKit global exists');
assert.equal(typeof window.QuoteKit.mount, 'function', 'mount() exported');
assert.equal(typeof window.QuoteKit.scan, 'function', 'scan() exported');

const config = {
  title: 'Concrete Driveway Cost Calculator',
  plan: 'free',
  active: true,
  fields: [
    { key: 'sqft', label: 'Driveway size', type: 'number', default: 400, min: 50, max: 5000 },
    {
      key: 'finish',
      label: 'Finish',
      type: 'select',
      options: [
        { label: 'Broom', value: 1 },
        { label: 'Stamped', value: 1.6 },
      ],
    },
    { key: 'removal', label: 'Tear out existing', type: 'checkbox' },
  ],
  formula: '(sqft * rate) * finish + removal * (sqft * tearout) + base_fee',
  constants: { rate: 6.5, tearout: 2.25, base_fee: 150 },
  result: { prefix: '$', decimals: 0, label: 'Estimated cost' },
  leadCapture: { enabled: true, gate: true, fields: ['name', 'email'], cta: 'Reveal my quote' },
};

const host = window.document.createElement('div');
window.document.body.appendChild(host);
window.QuoteKit.mount(host, config);

const sr = host.shadowRoot;
assert.ok(sr, 'shadow root attached');

const result = sr.querySelector('[data-qk-result]');
assert.ok(result, 'result element rendered');
assert.ok(result.classList.contains('qk-locked'), 'gated result starts locked');
assert.ok(result.textContent.includes('•'), 'locked result is masked, not the real number');

// Free plan → badge present.
assert.ok(sr.querySelector('.qk-badge'), 'free tier shows the powered-by badge');

// Change an input: 400 -> 1000 sqft.
const sqft = sr.querySelector('input[type="number"]');
sqft.value = '1000';
sqft.dispatchEvent(new window.Event('input', { bubbles: true }));

// Flip the select to "Stamped" (value 1.6).
const select = sr.querySelector('select');
select.value = '1';
select.dispatchEvent(new window.Event('change', { bubbles: true }));

// Fill lead form and submit (inline mode → simulated success, no network).
const email = sr.querySelector('input[type="email"]');
email.value = 'jo@example.com';
const btn = sr.querySelector('.qk-btn');
btn.dispatchEvent(new window.Event('click', { bubbles: true }));

await new Promise((r) => setTimeout(r, 600));

assert.ok(sr.querySelector('.qk-success'), 'success message replaces the lead form');
assert.ok(!result.classList.contains('qk-locked'), 'result unlocks after lead capture');
// (1000 * 6.5) * 1.6 + 0 + 150 = 10,550
assert.equal(result.textContent, '$10,550', `expected $10,550, got ${result.textContent}`);

// Unavailable state (canceled subscription → widget goes dark).
const darkHost = window.document.createElement('div');
window.document.body.appendChild(darkHost);
window.QuoteKit.mount(darkHost, { ...config, active: false });
assert.ok(
  darkHost.shadowRoot.querySelector('.qk-unavailable'),
  'inactive calculator renders the unavailable card'
);
assert.ok(
  !darkHost.shadowRoot.querySelector('.qk-btn'),
  'inactive calculator renders no interactive UI'
);

// Formula safety: unknown variables are rejected at compile time.
const badHost = window.document.createElement('div');
window.document.body.appendChild(badHost);
window.QuoteKit.mount(badHost, { ...config, formula: 'sqft * window' });
assert.equal(
  badHost.shadowRoot.querySelector('[data-qk-result]').textContent,
  '—',
  'unknown formula variable degrades to em dash'
);

console.log('✓ widget smoke test passed');
