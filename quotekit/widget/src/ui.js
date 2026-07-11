import { baseStyles } from './styles.js';
import { compileFormula } from './formula.js';

// ---- tiny DOM helpers (textContent only — config strings are customer
// input and must never hit innerHTML) ----------------------------------

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function attachStyles(shadow) {
  const style = document.createElement('style');
  style.textContent = baseStyles;
  shadow.appendChild(style);
}

export function renderSkeleton(shadow) {
  shadow.innerHTML = '';
  attachStyles(shadow);
  const skel = el('div', 'qk-skel');
  for (const w of ['40%', '100%', '100%', '55%']) {
    const bar = el('div', 'qk-skel-bar');
    bar.style.width = w;
    skel.appendChild(bar);
  }
  shadow.appendChild(skel);
}

export function renderUnavailable(shadow) {
  shadow.innerHTML = '';
  attachStyles(shadow);
  shadow.appendChild(
    el('div', 'qk-unavailable', 'This calculator is temporarily unavailable.')
  );
}

// ---- main render ------------------------------------------------------

// ctx: { calcId, submitLead(payload) -> Promise, badgeHref }
export function render(shadow, config, ctx) {
  shadow.innerHTML = '';
  attachStyles(shadow);

  if (config.active === false || config.published === false) {
    shadow.appendChild(
      el('div', 'qk-unavailable', 'This calculator is temporarily unavailable.')
    );
    return;
  }

  const root = el('div', 'qk');
  applyTheme(root, config.theme || {});

  if (config.title) root.appendChild(el('div', 'qk-title', config.title));

  // -- fields --
  const fields = Array.isArray(config.fields) ? config.fields : [];
  const constants = config.constants || {};
  const state = {};
  const allowed = new Set([
    ...fields.map((f) => f.key),
    ...Object.keys(constants),
  ]);

  let evaluate = null;
  let formulaError = null;
  try {
    evaluate = compileFormula(String(config.formula || '0'), allowed);
  } catch (err) {
    formulaError = err;
  }

  for (const field of fields) {
    root.appendChild(buildField(field, state, () => compute()));
  }

  // -- result line: LABEL ······· $1,234 --
  const resultCfg = config.result || {};
  const gated = !!(config.leadCapture && config.leadCapture.enabled && config.leadCapture.gate);
  let unlocked = !gated;
  let lastValue = null;

  const resultRow = el('div', 'qk-result');
  resultRow.appendChild(
    el('span', 'qk-result-label', resultCfg.label || 'Estimate')
  );
  resultRow.appendChild(el('span', 'qk-leader'));
  const valueEl = el('span', 'qk-result-value');
  valueEl.setAttribute('data-qk-result', '');
  valueEl.setAttribute('aria-live', 'polite');
  resultRow.appendChild(valueEl);
  root.appendChild(resultRow);

  let gateNote = null;
  if (gated) {
    gateNote = el(
      'div',
      'qk-gate-note',
      'Enter your details below to reveal your instant quote.'
    );
    root.appendChild(gateNote);
  }

  function compute() {
    if (!evaluate) {
      valueEl.textContent = '—';
      if (formulaError) console.warn('[QuoteKit] formula error:', formulaError.message);
      return;
    }
    try {
      lastValue = evaluate({ ...constants, ...state });
    } catch (err) {
      valueEl.textContent = '—';
      console.warn('[QuoteKit] formula error:', err.message);
      return;
    }
    if (unlocked) {
      valueEl.classList.remove('qk-locked');
      valueEl.textContent = formatValue(lastValue, resultCfg);
    } else {
      valueEl.classList.add('qk-locked');
      valueEl.textContent = `${resultCfg.prefix || ''}• • •`;
    }
  }

  // -- lead capture --
  const lc = config.leadCapture || {};
  if (lc.enabled) {
    root.appendChild(
      buildLeadForm(lc, {
        onSubmit: async (contact) => {
          const payload = {
            calcId: ctx.calcId,
            ownerUid: config.ownerUid,
            inputs: { ...state },
            result: typeof lastValue === 'number' ? round2(lastValue) : 0,
            contact,
            createdAt: new Date(),
            page: String(location.href).slice(0, 500),
          };
          // Demo/inline mode (marketing pages, builder preview): no owner to
          // attribute the lead to, so we simulate success without writing.
          if (!config.ownerUid || !ctx.calcId || ctx.calcId === 'inline') {
            await new Promise((r) => setTimeout(r, 350));
          } else {
            await ctx.submitLead(payload);
          }
        },
        onSuccess: () => {
          unlocked = true;
          if (gateNote) gateNote.remove();
          compute();
        },
        successMessage:
          lc.successMessage || 'Thanks — your quote is on its way.',
      })
    );
  }

  // -- "powered by" badge: the free tier's marketing loop --
  const paid = config.plan === 'starter' || config.plan === 'pro';
  if (!paid) {
    const badge = el('a', 'qk-badge');
    badge.href = ctx.badgeHref || 'https://quotekit.web.app/?utm_source=badge';
    badge.target = '_blank';
    badge.rel = 'noopener';
    badge.appendChild(el('span', 'qk-bolt', '⚡'));
    badge.appendChild(el('span', null, 'Powered by QuoteKit'));
    root.appendChild(badge);
  }

  shadow.appendChild(root);
  compute();
}

// ---- field controls ----------------------------------------------------

function buildField(field, state, onChange) {
  const wrap = el('div', 'qk-field');
  const id = `qk-${field.key}`;

  if (field.type === 'checkbox') {
    const checkedValue = num(field.checkedValue, 1);
    const uncheckedValue = num(field.uncheckedValue, 0);
    state[field.key] = field.default ? checkedValue : uncheckedValue;

    const label = el('label', 'qk-check');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = id;
    input.checked = !!field.default;
    input.addEventListener('change', () => {
      state[field.key] = input.checked ? checkedValue : uncheckedValue;
      onChange();
    });
    label.appendChild(input);
    label.appendChild(el('span', null, field.label || field.key));
    wrap.appendChild(label);
    return wrap;
  }

  const label = el('label', 'qk-label', field.label || field.key);
  label.setAttribute('for', id);
  wrap.appendChild(label);

  if (field.type === 'select') {
    const select = el('select', 'qk-select');
    select.id = id;
    const options = Array.isArray(field.options) ? field.options : [];
    options.forEach((opt, i) => {
      const o = el('option', null, opt.label != null ? String(opt.label) : String(opt.value));
      o.value = String(i);
      select.appendChild(o);
    });
    const defIndex = Math.max(0, options.findIndex((o) => o.default));
    select.value = String(defIndex === -1 ? 0 : defIndex);
    state[field.key] = options.length ? num(options[Number(select.value)].value, 0) : 0;
    select.addEventListener('change', () => {
      state[field.key] = num(options[Number(select.value)].value, 0);
      onChange();
    });
    wrap.appendChild(select);
    return wrap;
  }

  // default: number input
  const input = el('input', 'qk-input');
  input.type = 'number';
  input.id = id;
  input.inputMode = 'decimal';
  if (field.min != null) input.min = field.min;
  if (field.max != null) input.max = field.max;
  if (field.step != null) input.step = field.step;
  const def = num(field.default, 0);
  input.value = String(def);
  state[field.key] = def;
  input.addEventListener('input', () => {
    state[field.key] = clamp(num(parseFloat(input.value), 0), field.min, field.max);
    onChange();
  });
  wrap.appendChild(input);
  return wrap;
}

// ---- lead form ---------------------------------------------------------

function buildLeadForm(lc, { onSubmit, onSuccess, successMessage }) {
  const container = el('div', 'qk-leadform');
  const wanted = Array.isArray(lc.fields) && lc.fields.length ? lc.fields : ['email'];

  const inputs = {};
  const specs = [
    { key: 'name', label: 'Name', type: 'text', autocomplete: 'name' },
    { key: 'email', label: 'Email', type: 'email', autocomplete: 'email' },
    { key: 'phone', label: 'Phone', type: 'tel', autocomplete: 'tel' },
  ];
  for (const spec of specs) {
    if (spec.key !== 'email' && !wanted.includes(spec.key)) continue;
    const input = el('input', 'qk-input');
    input.type = spec.type;
    input.placeholder = spec.label;
    input.autocomplete = spec.autocomplete;
    input.setAttribute('aria-label', spec.label);
    if (spec.key === 'email') input.required = true;
    inputs[spec.key] = input;
    container.appendChild(input);
  }

  // Honeypot: bots fill it, humans never see it. If filled, we fake success
  // and write nothing.
  const hpWrap = el('div', 'qk-hp');
  const hp = el('input');
  hp.type = 'text';
  hp.tabIndex = -1;
  hp.autocomplete = 'off';
  hp.setAttribute('aria-hidden', 'true');
  hp.name = 'website';
  hpWrap.appendChild(hp);
  container.appendChild(hpWrap);

  const errorEl = el('div', 'qk-error');
  errorEl.style.display = 'none';
  container.appendChild(errorEl);

  const btn = el('button', 'qk-btn', lc.cta || 'Email me this quote');
  btn.type = 'button';
  container.appendChild(btn);

  btn.addEventListener('click', async () => {
    errorEl.style.display = 'none';
    const email = (inputs.email.value || '').trim();
    if (!/.+@.+\..+/.test(email)) {
      errorEl.textContent = 'Enter a valid email to get your quote.';
      errorEl.style.display = 'block';
      inputs.email.focus();
      return;
    }
    const contact = { email };
    if (inputs.name && inputs.name.value.trim()) contact.name = inputs.name.value.trim().slice(0, 120);
    if (inputs.phone && inputs.phone.value.trim()) contact.phone = inputs.phone.value.trim().slice(0, 40);

    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = 'Sending…';
    try {
      if (!hp.value) await onSubmit(contact);
      const success = el('div', 'qk-success', successMessage);
      success.setAttribute('role', 'status');
      container.replaceWith(success);
      onSuccess();
    } catch (err) {
      console.warn('[QuoteKit] lead submit failed:', err);
      errorEl.textContent = "Couldn't send just now — please try again.";
      errorEl.style.display = 'block';
      btn.disabled = false;
      btn.textContent = original;
    }
  });

  return container;
}

// ---- misc --------------------------------------------------------------

function applyTheme(root, theme) {
  if (theme.accent) root.style.setProperty('--qk-accent', String(theme.accent));
  if (theme.radius != null) root.style.setProperty('--qk-radius', `${parseInt(theme.radius, 10) || 14}px`);
  if (theme.background) root.style.setProperty('--qk-bg', String(theme.background));
}

function formatValue(value, resultCfg) {
  const decimals = resultCfg.decimals != null ? resultCfg.decimals : 0;
  const formatted = new Intl.NumberFormat(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
  return `${resultCfg.prefix || ''}${formatted}${resultCfg.suffix || ''}`;
}

function num(v, fallback) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clamp(v, min, max) {
  if (min != null && v < Number(min)) return Number(min);
  if (max != null && v > Number(max)) return Number(max);
  return v;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}
