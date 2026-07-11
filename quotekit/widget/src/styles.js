// All widget CSS lives inside the shadow root, so nothing here can leak into
// the host page and nothing on the host page (except inheritable props we
// explicitly reset) can leak in. Colors/radius come from the calculator's
// theme via custom properties set on the container.

export const baseStyles = `
:host {
  display: block;
  contain: content;
}
* { box-sizing: border-box; margin: 0; padding: 0; }

.qk {
  --qk-accent: #CE4A12;
  --qk-accent-ink: #ffffff;
  --qk-ink: #1b1916;
  --qk-muted: #6f695e;
  --qk-line: #e3ddd1;
  --qk-bg: #ffffff;
  --qk-radius: 14px;

  font-family: system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  font-size: 15px;
  line-height: 1.45;
  color: var(--qk-ink);
  background: var(--qk-bg);
  border: 1px solid var(--qk-line);
  border-radius: var(--qk-radius);
  padding: 20px;
  max-width: 460px;
  font-variant-numeric: tabular-nums;
}

.qk-title {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin-bottom: 14px;
}

.qk-field { margin-bottom: 12px; }
.qk-label {
  display: block;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--qk-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 5px;
}
.qk-input, .qk-select {
  width: 100%;
  font: inherit;
  color: inherit;
  background: #fff;
  border: 1px solid var(--qk-line);
  border-radius: calc(var(--qk-radius) - 6px);
  padding: 9px 11px;
  appearance: none;
}
.qk-select {
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%236f695e' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 12px center;
  padding-right: 30px;
}
.qk-input:focus-visible, .qk-select:focus-visible,
.qk-btn:focus-visible, .qk-check input:focus-visible, .qk-badge:focus-visible {
  outline: 2px solid var(--qk-accent);
  outline-offset: 2px;
}

.qk-check {
  display: flex;
  align-items: center;
  gap: 9px;
  padding: 9px 11px;
  border: 1px solid var(--qk-line);
  border-radius: calc(var(--qk-radius) - 6px);
  cursor: pointer;
  font-weight: 500;
}
.qk-check input {
  width: 16px; height: 16px;
  accent-color: var(--qk-accent);
  cursor: pointer;
}

/* The estimate line: dotted leader between label and figure, like a line
   item on a paper quote. */
.qk-result {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px solid var(--qk-line);
}
.qk-result-label {
  font-size: 12.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--qk-muted);
  white-space: nowrap;
}
.qk-leader {
  flex: 1;
  border-bottom: 2px dotted var(--qk-line);
  transform: translateY(-4px);
}
.qk-result-value {
  font-size: 27px;
  font-weight: 800;
  letter-spacing: -0.02em;
  white-space: nowrap;
  transition: filter 0.25s ease;
}
.qk-result-value.qk-locked { filter: blur(9px); user-select: none; }
.qk-gate-note {
  margin-top: 6px;
  font-size: 12.5px;
  color: var(--qk-muted);
}

.qk-leadform { margin-top: 14px; display: grid; gap: 8px; }
.qk-btn {
  font: inherit;
  font-weight: 700;
  color: var(--qk-accent-ink);
  background: var(--qk-accent);
  border: 0;
  border-radius: calc(var(--qk-radius) - 6px);
  padding: 11px 14px;
  cursor: pointer;
  transition: transform 0.08s ease, opacity 0.15s ease;
}
.qk-btn:hover { opacity: 0.92; }
.qk-btn:active { transform: translateY(1px); }
.qk-btn[disabled] { opacity: 0.55; cursor: default; }

.qk-error {
  font-size: 13px;
  color: #b3261e;
}
.qk-success {
  margin-top: 14px;
  padding: 11px 13px;
  border-radius: calc(var(--qk-radius) - 6px);
  background: color-mix(in srgb, var(--qk-accent) 10%, #fff);
  border: 1px solid color-mix(in srgb, var(--qk-accent) 30%, #fff);
  font-weight: 600;
  font-size: 14px;
}

/* honeypot — visually gone, still in the accessibility tree opt-out */
.qk-hp {
  position: absolute !important;
  width: 1px; height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.qk-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  margin-top: 14px;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--qk-muted);
  text-decoration: none;
}
.qk-badge:hover { color: var(--qk-ink); }
.qk-badge .qk-bolt { color: var(--qk-accent); }

.qk-unavailable {
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 13.5px;
  color: #8a8478;
  border: 1px dashed #d9d3c7;
  border-radius: 12px;
  padding: 14px 16px;
  max-width: 460px;
}

/* loading skeleton */
.qk-skel {
  border: 1px solid #e6e0d4;
  border-radius: 14px;
  padding: 20px;
  max-width: 460px;
}
.qk-skel-bar {
  height: 13px;
  border-radius: 6px;
  background: linear-gradient(90deg, #efeadf 25%, #f7f3ea 50%, #efeadf 75%);
  background-size: 200% 100%;
  animation: qk-shimmer 1.2s infinite linear;
  margin-bottom: 12px;
}
@keyframes qk-shimmer {
  from { background-position: 200% 0; }
  to { background-position: -200% 0; }
}

@media (max-width: 380px) {
  .qk { padding: 16px; }
  .qk-result-value { font-size: 23px; }
}
@media (prefers-reduced-motion: reduce) {
  .qk-skel-bar { animation: none; }
  .qk-btn, .qk-result-value { transition: none; }
}
`;
