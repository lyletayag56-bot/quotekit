# QuoteKit

Embeddable instant-quote calculators for home-services contractors. A contractor builds a calculator in the dashboard, pastes one script tag on their site, and visitors get a live estimate — gated behind a lead-capture form that lands in the contractor's inbox.

Everything runs on a single Firebase project. There is no application server: Firestore security rules **are** the backend contract, the widget talks to Firestore over plain REST, and the only Cloud Functions are two small triggers that piggyback on the Stripe extension (which needs Functions anyway).

```
                        ┌────────────────────────────────────────┐
                        │            Firebase Hosting            │
                        │  /            Eleventy marketing site  │
                        │  /app/        Alpine.js dashboard      │
                        │  /widget.js   Vite IIFE bundle (13 kB) │
                        └────────┬───────────────────────────────┘
                                 │
  contractor's website           │ reads/writes governed by
  <script src=".../widget.js">───┤ firestore.rules only
                                 ▼
                        ┌────────────────────┐   ┌──────────────────────────┐
                        │      Firestore     │◄──┤ Cloud Functions           │
                        │  calculators/      │   │  syncPlanToCalculators    │
                        │  leads/            │   │  onLeadCreated → mail/    │
                        │  customers/ (ext)  │   └──────────────────────────┘
                        │  products/  (ext)  │◄── invertase/firestore-stripe-
                        │  mail/      (ext)  │    payments extension
                        └────────────────────┘
```

## Repo layout

```
widget/      Vanilla-JS embed. Vite → dist/widget.js (single IIFE, Shadow DOM,
             Firestore REST via fetch, expr-eval formulas). No SDK, no framework.
app/         Dashboard. Static HTML + Alpine.js + Firebase JS SDK from CDN.
             No build step — copied verbatim into dist/app/.
marketing/   Eleventy site: homepage, /docs/, and one landing page per industry
             (each with a live inline-config demo of the actual widget).
functions/   Two triggers (Node 20): plan sync from Stripe subscription docs,
             and lead-alert emails via the Trigger Email extension.
firestore.rules          The security contract (read the comments — it's the spec).
firestore.indexes.json   Composite indexes for the dashboard's lead queries.
firebase.json            Hosting (dist/), widget.js cache/CORS headers, emulators.
```

All three frontends build into one `dist/` folder and deploy as one Hosting site.

## Quick start (local, no Firebase project needed)

```bash
npm install          # postinstall also installs widget/ and marketing/ deps
npm run dev          # builds everything, then starts the emulator suite
```

Open http://localhost:5000 — the marketing site's demos work immediately (they use inline `data-config`, zero backend). The dashboard at http://localhost:5000/app/ auto-detects localhost and talks to the emulators (Auth :9099, Firestore :8080, Functions :5001, Emulator UI :4000), so you can sign up, build calculators, and submit test leads with no real project and no quota.

For iterating, run three terminals instead:

```bash
npm run watch:widget    # vite rebuild on change → dist/widget.js
npm run watch:site      # eleventy --watch → dist/
npm run emulators       # firebase emulators:start (serves dist/)
```

Dashboard files (`app/`) have no build step, but the hosting emulator serves `dist/app/`, so re-run `npm run build:app` (or just `npm run build`) after editing them.

Tests: `npm run test:widget` builds the bundle and runs a jsdom smoke test covering mount/scan, formula evaluation ($10,550 fixture), the lead-capture gate unlock, the free-plan badge, the `active:false` dark state, and formula-safety degradation.

## Going to production

1. Create a Firebase project on the **Blaze plan** (required for Cloud Functions and extensions; costs stay in the free tier at low volume). Enable **Authentication** (Email/Password + Google) and **Firestore**.
2. Fill in the placeholders:
   - `.firebaserc` — your project id.
   - `widget/.env` (copy from `.env.example`) — project id + web API key. These are baked into `widget.js` at build time; Firebase web keys are public identifiers, not secrets.
   - `app/js/firebase-config.js` — the same web-app config.
   - `marketing/src/_data/site.json` — your production URL.
3. Deploy the contract first: `npm run deploy:rules` (rules + indexes).
4. Install the Stripe extension:
   ```bash
   firebase ext:install invertase/firestore-stripe-payments
   ```
   Use `customers` as the customer collection and `products` as the products collection, and give it your Stripe **restricted** key. Follow the extension's post-install output to register the Stripe webhook (it prints the exact URL and event list).
5. In Stripe, create two products with recurring prices — Starter ($15/mo) and Pro ($29/mo) — and set **product metadata** `firebaseRole=starter` and `firebaseRole=pro`. That metadata is what `syncPlanToCalculators` reads (via the subscription doc's `role` field) to flip a contractor's calculators to a paid plan. Mark both products active so the extension syncs them into `products/` for the billing page.
6. Optional lead-alert emails: install `firebase ext:install firebase/firestore-send-email`, pointed at the `mail` collection, with your SMTP credentials. `onLeadCreated` writes a formatted message there whenever a lead arrives (per-user opt-in via Settings).
7. `npm run deploy` — builds everything and ships Hosting + Functions + rules in one go.

A contractor's embed is then literally:

```html
<script async src="https://YOUR-PROJECT.web.app/widget.js" data-calc-id="CALC_ID"></script>
```

Optional attributes: `data-target="#selector"` to render into an existing element, `data-config='{...}'` for a no-backend inline demo. The bundle also exposes `window.QuoteKit = { scan, mount }` — `mount(el, config)` is what powers the dashboard's live preview.

## The security-rules contract (why there's no server)

`firestore.rules` is the load-bearing wall; the important clauses:

**Calculators.** Anyone may read a calculator only if `published == true && active == true` — that single line is both the publish switch and the kill switch. Owners CRUD their own docs, but *clients can never grant themselves a paid plan*: creates must have `plan == 'free'` and `active == true`, and every update must **omit** `plan` and `active` entirely (and set `updatedAt = serverTimestamp`). The only writer of paid plans is the Admin SDK inside `syncPlanToCalculators`, which bypasses rules. One deliberate exception: an owner may set `(plan: 'free', active: true)` — the "re-publish on Free" downgrade path after a subscription lapses.

**Leads.** Create-only for the public, and only with an exact shape: `hasOnly([calcId, ownerUid, inputs, result, contact, createdAt, page])`, a sane email regex, and a `get()` cross-check that the referenced calculator is published, active, and actually belongs to `ownerUid` — so nobody can spray leads into another account. Owners can read and delete their own leads; nobody can update one.

**Billing.** `customers/{uid}/...` is readable by its owner; `checkout_sessions` are client-created (that's how the Stripe extension initiates checkout); subscription and payment docs are written only by the extension. `products/` and `prices/` are public-read where active. `mail/` is function-write-only. `settings/{uid}` is owner-only.

The widget goes dark automatically on cancellation: Stripe webhook → extension updates the subscription doc → `syncPlanToCalculators` sets `active:false` on all paid calculators → public reads start failing rules → the embed renders a quiet "temporarily unavailable" card instead of breaking the contractor's page. Free-tier calculators are never touched by the sync.

## Design notes

The visual identity is a contractor's estimate pad: manila paper (`#F5F0E1`), safety orange (`#CE4A12`), steel blue (`#2B4C6F`), Archivo + IBM Plex Mono, and dotted leader lines (the `......` between a line item and its price) as the signature device across the marketing site, dashboard, and widget results. The hero *is* the product — a live widget, not a screenshot.

`dist/widget.js` measures **40.48 kB raw / 13.35 kB gzip** against a 30 kB-gzip budget. It renders into an open Shadow DOM (host-page CSS can't break it; `widget/index.html` is a hostile-CSS harness that proves it), builds all DOM via `textContent` (no innerHTML with user data), whitelists formula variables through expr-eval, and fails soft: a 403/404 shows the unavailable card, an unknown formula variable degrades the result to "—", and a honeypot-caught bot gets a fake success.

## Known gaps / roadmap

Spam protection is honeypot-only; before real traffic, add **Firebase App Check** to the Firestore REST calls and consider a per-IP write budget (needs a small callable function or a proxy). There's no per-domain embed restriction — any site can embed any published calculator (arguably a feature; revisit if abuse shows up). Lead-alert email deliverability depends on your SMTP provider's domain setup. Other obvious next steps: custom domains per contractor, multi-currency, a lead webhook/Zapier integration, calculator duplication and versioning, and usage analytics beyond the 30-day lead chart.
