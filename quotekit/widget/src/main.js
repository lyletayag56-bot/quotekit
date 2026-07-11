// QuoteKit embed loader.
//
// Customer usage (this is the whole integration):
//   <script async src="https://YOUR-SITE.web.app/widget.js" data-calc-id="abc123"></script>
//
// Optional attributes:
//   data-target="#selector"  render into an existing element instead of
//                            inserting a container right after the script tag
//   data-config='{...json}'  inline config, no Firestore read (demos, docs)
//
// Also exposed as window.QuoteKit = { scan, mount } — `mount(el, config)` is
// what the dashboard's live preview uses.

import { fetchCalculator, submitLead } from './api.js';
import { render, renderSkeleton, renderUnavailable } from './ui.js';

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const BADGE_HREF = `https://${env.VITE_FB_PROJECT_ID || 'quotekit'}.web.app/?utm_source=badge&utm_medium=widget`;
const MOUNTED = 'qkMounted';

function domReady() {
  if (document.readyState !== 'loading') return Promise.resolve();
  return new Promise((resolve) =>
    document.addEventListener('DOMContentLoaded', resolve, { once: true })
  );
}

function shadowFor(host) {
  const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });
  shadow.innerHTML = '';
  return shadow;
}

// Render a config object into an element. Safe to call repeatedly on the
// same element (re-uses its shadow root) — the dashboard preview does this.
export function mount(host, config, calcId) {
  const shadow = shadowFor(host);
  render(shadow, config || {}, {
    calcId: calcId || 'inline',
    submitLead,
    badgeHref: BADGE_HREF,
  });
  return host;
}

async function initScript(script) {
  script.dataset[MOUNTED] = '1';

  // Where to render: an explicit target, or a container we insert right
  // after the script tag itself.
  let host = null;
  const selector = script.dataset.target;
  if (selector) {
    host = document.querySelector(selector);
    if (!host) {
      await domReady();
      host = document.querySelector(selector);
    }
    if (!host) {
      console.warn(`[QuoteKit] data-target "${selector}" not found.`);
      return;
    }
  } else {
    host = document.createElement('div');
    host.style.display = 'block';
    script.insertAdjacentElement('afterend', host);
  }

  const shadow = shadowFor(host);

  // Inline config path — no network at all.
  if (script.dataset.config) {
    let config;
    try {
      config = JSON.parse(script.dataset.config);
    } catch (err) {
      console.warn('[QuoteKit] invalid inline data-config JSON.', err);
      return;
    }
    render(shadow, config, { calcId: 'inline', submitLead, badgeHref: BADGE_HREF });
    return;
  }

  const calcId = script.dataset.calcId;
  if (!calcId) return;

  renderSkeleton(shadow);
  try {
    const config = await fetchCalculator(calcId);
    render(shadow, config, { calcId, submitLead, badgeHref: BADGE_HREF });
  } catch (err) {
    // 403 = unpublished (rules denied the read), 404 = deleted. Either way
    // the widget should degrade to a quiet placeholder, never break the page.
    if (err && (err.status === 403 || err.status === 404)) {
      renderUnavailable(shadow);
    } else {
      shadow.innerHTML = '';
      console.warn('[QuoteKit] could not load calculator:', err);
    }
  }
}

// Find every QuoteKit script tag on the page that hasn't been initialized
// yet. Supports multiple widgets per page.
export function scan() {
  const scripts = document.querySelectorAll(
    'script[data-calc-id]:not([data-qk-mounted]), script[data-config]:not([data-qk-mounted])'
  );
  scripts.forEach((s) => {
    if (!s.dataset[MOUNTED]) initScript(s);
  });
}

scan();
