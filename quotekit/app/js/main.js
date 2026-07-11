import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup,
  sendPasswordResetEmail, signOut, connectAuthEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getFirestore, connectFirestoreEmulator, collection, doc, addDoc, updateDoc,
  deleteDoc, onSnapshot, query, where, orderBy, limit, getDoc, getDocs,
  setDoc, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import {
  getFunctions, httpsCallable, connectFunctionsEmulator,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
import Alpine from 'https://cdn.jsdelivr.net/npm/alpinejs@3.14.1/dist/module.esm.js';

import { firebaseConfig, USE_EMULATORS, EMULATOR_PORTS } from './firebase-config.js';
import { TEMPLATES } from './templates.js';

const fbApp = initializeApp(firebaseConfig);
const auth = getAuth(fbApp);
const db = getFirestore(fbApp);
const fns = getFunctions(fbApp);

if (USE_EMULATORS) {
  connectAuthEmulator(auth, `http://localhost:${EMULATOR_PORTS.auth}`, { disableWarnings: true });
  connectFirestoreEmulator(db, 'localhost', EMULATOR_PORTS.firestore);
  connectFunctionsEmulator(fns, 'localhost', EMULATOR_PORTS.functions);
}

// Kept OUTSIDE Alpine's reactive proxy on purpose (Chart.js and unsub
// functions misbehave when proxied).
let chartInstance = null;
let unsubs = [];
let previewTimer = null;

const deep = (v) => JSON.parse(JSON.stringify(v));

Alpine.data('app', () => ({
  // ---- state ----
  ready: false,
  user: null,
  authMode: 'signin',
  email: '',
  password: '',
  authError: '',
  authBusy: false,

  view: 'calculators',
  notice: '',

  templates: TEMPLATES,
  calcs: [],
  newMenu: false,

  editing: null,
  constantRows: [],
  saving: false,
  saveState: '',
  widgetAvailable: typeof window.QuoteKit !== 'undefined',

  embedFor: null,
  copied: false,

  leads: [],
  leadFilter: 'all',

  products: [],
  sub: null,
  billingBusy: false,
  billingError: '',

  settings: { leadAlerts: false, notifyEmail: '' },
  settingsState: '',

  // ---- lifecycle ----
  init() {
    onAuthStateChanged(auth, (user) => {
      this.user = user;
      this.ready = true;
      unsubs.forEach((u) => u());
      unsubs = [];
      if (user) this.afterSignIn();
      else this.resetState();
    });

    const params = new URLSearchParams(location.search);
    if (params.get('checkout') === 'success') {
      this.notice = 'Payment complete — your plan is active. Widgets update within a few seconds.';
      history.replaceState(null, '', location.pathname);
    }
  },

  resetState() {
    this.calcs = [];
    this.leads = [];
    this.sub = null;
    this.editing = null;
    this.view = 'calculators';
  },

  afterSignIn() {
    const uid = this.user.uid;

    // Calculators — query must filter ownerUid to satisfy the list rule.
    unsubs.push(onSnapshot(
      query(collection(db, 'calculators'), where('ownerUid', '==', uid), orderBy('updatedAt', 'desc')),
      (snap) => { this.calcs = snap.docs.map((d) => ({ id: d.id, ...d.data() })); },
      (err) => console.error('calculators listener:', err)
    ));

    // Leads (latest 500).
    unsubs.push(onSnapshot(
      query(collection(db, 'leads'), where('ownerUid', '==', uid), orderBy('createdAt', 'desc'), limit(500)),
      (snap) => {
        this.leads = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        if (this.view === 'leads') this.$nextTick(() => this.renderChart());
      },
      (err) => console.error('leads listener:', err)
    ));

    // Active subscription (written by the Stripe extension).
    unsubs.push(onSnapshot(
      query(collection(db, `customers/${uid}/subscriptions`), where('status', 'in', ['trialing', 'active'])),
      (snap) => { this.sub = snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() }; },
      () => { /* collection may not exist until the extension is installed */ }
    ));

    this.loadSettings();
    this.loadProducts();
  },

  go(view) {
    this.view = view;
    if (view === 'leads') this.$nextTick(() => this.renderChart());
  },

  // ---- auth ----
  async submitAuth() {
    this.authError = '';
    this.authBusy = true;
    try {
      if (this.authMode === 'signup') {
        await createUserWithEmailAndPassword(auth, this.email.trim(), this.password);
      } else {
        await signInWithEmailAndPassword(auth, this.email.trim(), this.password);
      }
    } catch (err) {
      this.authError = friendlyAuthError(err);
    } finally {
      this.authBusy = false;
    }
  },

  async googleSignIn() {
    this.authError = '';
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err) {
      this.authError = friendlyAuthError(err);
    }
  },

  async resetPassword() {
    if (!this.email.trim()) { this.authError = 'Enter your email first, then tap "Forgot password".'; return; }
    try {
      await sendPasswordResetEmail(auth, this.email.trim());
      this.authError = 'Reset link sent — check your inbox.';
    } catch (err) {
      this.authError = friendlyAuthError(err);
    }
  },

  doSignOut() { signOut(auth); },

  planLabel() { return this.sub ? (this.sub.role || 'pro') : 'free'; },

  // ---- calculators ----
  async createCalc(template) {
    this.newMenu = false;
    const base = deep(template.calc);
    const payload = {
      ...sanitizeCalc(base),
      ownerUid: this.user.uid,
      plan: 'free',          // rules reject anything else on create
      active: true,
      published: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    try {
      const ref = await addDoc(collection(db, 'calculators'), payload);
      this.edit({ id: ref.id, ...base, plan: 'free', active: true, published: false });
    } catch (err) {
      console.error(err);
      this.notice = 'Could not create the calculator — check the console and your Firestore rules deployment.';
    }
  },

  edit(calc) {
    const e = deep({ ...calc });
    e.fields = e.fields || [];
    e.constants = e.constants || {};
    e.result = { label: 'Estimate', prefix: '$', suffix: '', decimals: 0, ...(e.result || {}) };
    e.leadCapture = { enabled: true, gate: false, fields: ['email'], cta: 'Email me this quote', successMessage: 'Thanks — your quote is on its way.', ...(e.leadCapture || {}) };
    if (!Array.isArray(e.leadCapture.fields)) e.leadCapture.fields = ['email'];
    e.theme = { accent: '#CE4A12', radius: 14, ...(e.theme || {}) };
    delete e.createdAt; delete e.updatedAt; // never sent back; createdAt is immutable per rules
    this.editing = e;
    this.constantRows = Object.entries(e.constants).map(([key, value]) => ({ key, value }));
    this.saveState = '';
    this.view = 'calculators';
  },

  closeEditor() { this.editing = null; },

  async save() {
    if (!this.editing) return;
    this.saving = true;
    this.saveState = 'Saving…';
    const payload = sanitizeCalc(this.editing, this.constantRows);
    try {
      await updateDoc(doc(db, 'calculators', this.editing.id), {
        ...payload,
        published: !!this.editing.published,
        updatedAt: serverTimestamp(),
        // plan/active intentionally omitted — the rules keep them, and only
        // the Stripe-sync function may upgrade them.
      });
      this.saveState = 'Saved ✓';
      setTimeout(() => { if (this.saveState === 'Saved ✓') this.saveState = ''; }, 2500);
    } catch (err) {
      console.error(err);
      this.saveState = 'Save failed — see console';
    } finally {
      this.saving = false;
    }
  },

  async removeCalc(calc) {
    if (!confirm(`Delete "${calc.title}"? The embedded widget will stop rendering. Existing leads are kept.`)) return;
    await deleteDoc(doc(db, 'calculators', calc.id));
    if (this.editing && this.editing.id === calc.id) this.editing = null;
  },

  // Paid plan lapsed → widget is dark. This is the explicit path back onto
  // the free tier (badge returns), which the security rules allow.
  async republishFree(calc) {
    await updateDoc(doc(db, 'calculators', calc.id), {
      plan: 'free',
      active: true,
      updatedAt: serverTimestamp(),
    });
    this.notice = `"${calc.title}" is live again on the Free plan (with the badge).`;
  },

  // ---- builder helpers ----
  slug(value) {
    let s = String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);
    if (/^[0-9]/.test(s)) s = 'f_' + s;
    return s;
  },

  addField(type) {
    const base = { key: '', label: '', type };
    if (type === 'number') Object.assign(base, { min: 0, max: 1000, step: 1, default: 10 });
    if (type === 'select') Object.assign(base, { options: [{ label: 'Option A', value: 1 }, { label: 'Option B', value: 2 }] });
    if (type === 'checkbox') Object.assign(base, { checkedValue: 1, uncheckedValue: 0, default: false });
    this.editing.fields.push(base);
  },

  addOption(field) { field.options.push({ label: '', value: 0 }); },

  setDefaultOption(field, index, checked) {
    field.options.forEach((o, i) => { o.default = checked && i === index; });
  },

  move(i, dir) {
    const arr = this.editing.fields;
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  },

  toggleLeadField(name, on) {
    const f = this.editing.leadCapture.fields;
    if (on && !f.includes(name)) f.push(name);
    if (!on) this.editing.leadCapture.fields = f.filter((x) => x !== name);
  },

  availableVars() {
    if (!this.editing) return [];
    const names = this.editing.fields.map((f) => f.key).filter(Boolean);
    for (const row of this.constantRows) if (row.key) names.push(row.key);
    return names;
  },

  formulaCheck() {
    if (!this.editing) return { ok: true, message: '' };
    if (!window.exprEval) return { ok: true, message: 'Validator unavailable offline.' };
    try {
      const parser = new window.exprEval.Parser({ operators: { assignment: false, in: false, concatenate: false } });
      const expr = parser.parse(String(this.editing.formula || ''));
      const allowed = new Set(this.availableVars());
      const unknown = expr.variables({ withMembers: true }).filter((v) => !allowed.has(v));
      if (unknown.length) return { ok: false, message: `Unknown variable(s): ${unknown.join(', ')} — add them as inputs or rates.` };
      return { ok: true, message: 'Formula looks good ✓' };
    } catch (err) {
      return { ok: false, message: err.message };
    }
  },

  previewSignature() {
    if (!this.editing) return '';
    // Touch everything the preview depends on so x-effect re-runs on any change.
    return JSON.stringify({ e: this.editing, c: this.constantRows });
  },

  refreshPreview(signature) {
    if (!signature) return;
    const host = this.$refs.preview;
    if (!host) return;
    if (!window.QuoteKit) { this.widgetAvailable = false; return; }
    this.widgetAvailable = true;
    clearTimeout(previewTimer);
    const snapshot = JSON.parse(signature);
    previewTimer = setTimeout(() => {
      const cfg = sanitizeCalc(snapshot.e, snapshot.c);
      cfg.plan = snapshot.e.plan || 'free';
      cfg.active = true;
      cfg.published = true;
      window.QuoteKit.mount(host, cfg, 'inline');
    }, 180);
  },

  // ---- embed ----
  embedSnippet(calc) {
    if (!calc) return '';
    return `<script async src="${location.origin}/widget.js" data-calc-id="${calc.id}"><\/script>`;
  },

  async copyEmbed() {
    try {
      await navigator.clipboard.writeText(this.embedSnippet(this.embedFor));
      this.copied = true;
      setTimeout(() => { this.copied = false; }, 1800);
    } catch {
      this.notice = 'Copy failed — select the code and copy manually.';
    }
  },

  // ---- leads ----
  openLeadsFor(calcId) {
    this.leadFilter = calcId;
    this.go('leads');
  },

  filteredLeads() {
    return this.leadFilter === 'all' ? this.leads : this.leads.filter((l) => l.calcId === this.leadFilter);
  },

  calcTitle(calcId) {
    const c = this.calcs.find((x) => x.id === calcId);
    return c ? c.title : calcId;
  },

  renderChart() {
    const canvas = document.getElementById('leadsChart');
    if (!canvas || !window.Chart) return;

    const days = 30;
    const labels = [];
    const buckets = new Map();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(today); d.setDate(today.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      labels.push(d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }));
      buckets.set(key, 0);
    }
    for (const lead of this.filteredLeads()) {
      const d = toDate(lead.createdAt);
      if (!d) continue;
      const key = d.toISOString().slice(0, 10);
      if (buckets.has(key)) buckets.set(key, buckets.get(key) + 1);
    }

    const data = [...buckets.values()];
    if (chartInstance) chartInstance.destroy();
    chartInstance = new window.Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label: 'Leads',
          data,
          borderColor: '#CE4A12',
          backgroundColor: 'rgba(206, 74, 18, 0.10)',
          fill: true,
          tension: 0.25,
          pointRadius: 2,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { precision: 0 } },
          x: { ticks: { maxTicksLimit: 10 } },
        },
      },
    });
  },

  exportCsv() {
    const rows = [['date', 'name', 'email', 'phone', 'quoted', 'calculator', 'page', 'inputs']];
    for (const l of this.filteredLeads()) {
      rows.push([
        toDate(l.createdAt)?.toISOString() || '',
        l.contact?.name || '', l.contact?.email || '', l.contact?.phone || '',
        l.result ?? '', this.calcTitle(l.calcId), l.page || '',
        JSON.stringify(l.inputs || {}),
      ]);
    }
    const csv = rows.map((r) => r.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'quotekit-leads.csv' });
    a.click();
    URL.revokeObjectURL(url);
  },

  // ---- billing (invertase/firestore-stripe-payments protocol) ----
  async loadProducts() {
    try {
      const prodSnap = await getDocs(query(collection(db, 'products'), where('active', '==', true)));
      const products = [];
      for (const p of prodSnap.docs) {
        const priceSnap = await getDocs(query(collection(db, `products/${p.id}/prices`), where('active', '==', true)));
        const prices = priceSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.unit_amount || 0) - (b.unit_amount || 0));
        if (prices.length) products.push({ id: p.id, ...p.data(), prices });
      }
      this.products = products.sort((a, b) => (a.prices[0].unit_amount || 0) - (b.prices[0].unit_amount || 0));
    } catch {
      this.products = []; // extension not installed yet — billing view explains
    }
  },

  async checkout(priceId) {
    this.billingBusy = true;
    this.billingError = '';
    try {
      const ref = await addDoc(collection(db, `customers/${this.user.uid}/checkout_sessions`), {
        price: priceId,
        allow_promotion_codes: true,
        success_url: `${location.origin}/app/?checkout=success`,
        cancel_url: `${location.origin}/app/`,
      });
      const stop = onSnapshot(ref, (snap) => {
        const data = snap.data() || {};
        if (data.error) {
          stop();
          this.billingBusy = false;
          this.billingError = data.error.message || 'Checkout failed.';
        }
        if (data.url) { stop(); location.assign(data.url); }
      });
    } catch (err) {
      this.billingBusy = false;
      this.billingError = 'Could not start checkout — is the Stripe extension installed? See the README.';
      console.error(err);
    }
  },

  async openPortal() {
    this.billingBusy = true;
    try {
      const createPortalLink = httpsCallable(fns, 'ext-firestore-stripe-payments-createPortalLink');
      const { data } = await createPortalLink({ returnUrl: `${location.origin}/app/` });
      location.assign(data.url);
    } catch (err) {
      this.billingBusy = false;
      this.billingError = 'Could not open the billing portal.';
      console.error(err);
    }
  },

  // ---- settings ----
  async loadSettings() {
    try {
      const snap = await getDoc(doc(db, 'settings', this.user.uid));
      if (snap.exists()) this.settings = { leadAlerts: false, notifyEmail: '', ...snap.data() };
      if (!this.settings.notifyEmail && this.user.email) this.settings.notifyEmail = this.user.email;
    } catch (err) { console.error(err); }
  },

  async saveSettings() {
    this.settingsState = 'Saving…';
    try {
      await setDoc(doc(db, 'settings', this.user.uid), {
        leadAlerts: !!this.settings.leadAlerts,
        notifyEmail: String(this.settings.notifyEmail || '').slice(0, 200),
      }, { merge: true });
      this.settingsState = 'Saved ✓';
      setTimeout(() => { this.settingsState = ''; }, 2500);
    } catch (err) {
      this.settingsState = 'Save failed';
      console.error(err);
    }
  },

  // ---- formatting ----
  fmtDate(ts) {
    const d = toDate(ts);
    return d ? d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  },

  fmtPrice(price) {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: (price.currency || 'usd').toUpperCase(),
      minimumFractionDigits: 0,
    }).format((price.unit_amount || 0) / 100);
  },
}));

// ---- pure helpers ------------------------------------------------------

// Normalize the builder's editing state into the exact shape the security
// rules validate and the widget consumes.
function sanitizeCalc(e, constantRows) {
  const fields = (e.fields || [])
    .filter((f) => f.key)
    .map((f) => {
      const out = { key: String(f.key), label: String(f.label || f.key), type: f.type || 'number' };
      if (out.type === 'number') {
        for (const k of ['min', 'max', 'step', 'default']) {
          const n = Number(f[k]);
          if (Number.isFinite(n)) out[k] = n;
        }
      } else if (out.type === 'select') {
        out.options = (f.options || [])
          .filter((o) => o.label !== '' && Number.isFinite(Number(o.value)))
          .map((o) => {
            const opt = { label: String(o.label), value: Number(o.value) };
            if (o.default) opt.default = true;
            return opt;
          });
      } else if (out.type === 'checkbox') {
        out.checkedValue = Number.isFinite(Number(f.checkedValue)) ? Number(f.checkedValue) : 1;
        out.uncheckedValue = Number.isFinite(Number(f.uncheckedValue)) ? Number(f.uncheckedValue) : 0;
        out.default = !!f.default;
      }
      return out;
    });

  const constants = {};
  const rows = constantRows || Object.entries(e.constants || {}).map(([key, value]) => ({ key, value }));
  for (const row of rows) {
    if (row.key && Number.isFinite(Number(row.value))) constants[row.key] = Number(row.value);
  }

  return {
    title: String(e.title || 'Untitled calculator').slice(0, 120),
    fields,
    formula: String(e.formula || '0').slice(0, 500),
    constants,
    result: {
      label: String(e.result?.label || 'Estimate'),
      prefix: String(e.result?.prefix ?? '$'),
      suffix: String(e.result?.suffix ?? ''),
      decimals: Math.min(4, Math.max(0, parseInt(e.result?.decimals, 10) || 0)),
    },
    leadCapture: {
      enabled: !!e.leadCapture?.enabled,
      gate: !!e.leadCapture?.gate,
      fields: Array.isArray(e.leadCapture?.fields) ? e.leadCapture.fields.filter((x) => ['name', 'email', 'phone'].includes(x)) : ['email'],
      cta: String(e.leadCapture?.cta || 'Email me this quote'),
      successMessage: String(e.leadCapture?.successMessage || 'Thanks — your quote is on its way.'),
    },
    theme: {
      accent: String(e.theme?.accent || '#CE4A12'),
      radius: Math.min(24, Math.max(0, parseInt(e.theme?.radius, 10) || 14)),
    },
  };
}

function toDate(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();  // Firestore Timestamp
  if (ts.seconds != null) return new Date(ts.seconds * 1000);
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function friendlyAuthError(err) {
  const code = err?.code || '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) {
    return 'Email or password is incorrect.';
  }
  if (code.includes('email-already-in-use')) return 'That email already has an account — try signing in.';
  if (code.includes('weak-password')) return 'Password needs at least 6 characters.';
  if (code.includes('invalid-email')) return 'That email address doesn\'t look right.';
  if (code.includes('popup-closed-by-user')) return '';
  return err?.message || 'Something went wrong — try again.';
}

window.Alpine = Alpine;
Alpine.start();
