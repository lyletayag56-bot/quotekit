// Firestore over plain REST. No SDK: the whole Firebase client library is
// bigger than this widget's entire budget. Two operations only:
//   GET  calculators/{id}   (public read, gated by security rules)
//   POST leads              (create-only, validated by security rules)

const env = (typeof import.meta !== 'undefined' && import.meta.env) || {};
const PROJECT_ID = env.VITE_FB_PROJECT_ID || 'your-project-id';
const API_KEY = env.VITE_FB_API_KEY || '';
const EMULATOR = env.VITE_FIRESTORE_EMULATOR_HOST || '';

const BASE = EMULATOR
  ? `http://${EMULATOR}/v1/projects/${PROJECT_ID}/databases/(default)/documents`
  : `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const KEY_PARAM = API_KEY ? `?key=${encodeURIComponent(API_KEY)}` : '';

export async function fetchCalculator(calcId) {
  const res = await fetch(`${BASE}/calculators/${encodeURIComponent(calcId)}${KEY_PARAM}`);
  if (!res.ok) {
    const err = new Error(`calculator fetch failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  const doc = await res.json();
  return decodeFields(doc.fields || {});
}

export async function submitLead(lead) {
  const res = await fetch(`${BASE}/leads${KEY_PARAM}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: encodeFields(lead) }),
  });
  if (!res.ok) {
    const err = new Error(`lead write failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// ---- Firestore typed-JSON <-> plain JS -------------------------------

function decodeValue(v) {
  if (v == null) return null;
  if ('stringValue' in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue' in v) return v.doubleValue;
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue' in v) return null;
  if ('timestampValue' in v) return new Date(v.timestampValue);
  if ('mapValue' in v) return decodeFields((v.mapValue && v.mapValue.fields) || {});
  if ('arrayValue' in v) return ((v.arrayValue && v.arrayValue.values) || []).map(decodeValue);
  return null;
}

export function decodeFields(fields) {
  const out = {};
  for (const k in fields) out[k] = decodeValue(fields[k]);
  return out;
}

function encodeValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  switch (typeof v) {
    case 'string':
      return { stringValue: v };
    case 'boolean':
      return { booleanValue: v };
    case 'number':
      return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
    case 'object':
      if (v instanceof Date) return { timestampValue: v.toISOString() };
      if (Array.isArray(v)) return { arrayValue: { values: v.map(encodeValue) } };
      return { mapValue: { fields: encodeFields(v) } };
    default:
      return { nullValue: null };
  }
}

export function encodeFields(obj) {
  const fields = {};
  for (const k in obj) {
    if (obj[k] === undefined) continue;
    fields[k] = encodeValue(obj[k]);
  }
  return fields;
}
