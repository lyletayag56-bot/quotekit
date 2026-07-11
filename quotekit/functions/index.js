// QuoteKit Cloud Functions — the only two pieces of server code in the
// product, and both are just glue around Firestore writes:
//
//  1. syncPlanToCalculators: the invertase/firestore-stripe-payments
//     extension writes subscription docs under customers/{uid}/subscriptions.
//     We mirror that status onto the customer's calculator docs, because the
//     widget only ever reads its own calculator doc. Active sub → paid plan,
//     badge off. Canceled sub → active:false → the embedded widget goes dark
//     (the retention loop). The owner can re-publish on the free tier from
//     the dashboard, which the security rules explicitly allow.
//
//  2. onLeadCreated: if the owner enabled lead alerts, queue a document for
//     the Trigger Email extension (mail/ collection).

const { onDocumentWritten, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions/v2');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

initializeApp();
const db = getFirestore();

const ACTIVE_STATUSES = ['active', 'trialing'];

exports.syncPlanToCalculators = onDocumentWritten(
  'customers/{uid}/subscriptions/{subId}',
  async (event) => {
    const uid = event.params.uid;

    // Look at ALL of the user's subscriptions, not just the changed one —
    // handles upgrades, downgrades, and multiple sub docs cleanly.
    const subsSnap = await db
      .collection(`customers/${uid}/subscriptions`)
      .where('status', 'in', ACTIVE_STATUSES)
      .get();

    const hasActive = !subsSnap.empty;
    // The Stripe extension writes `role` from the product's `firebaseRole`
    // metadata (we set 'starter' / 'pro' on the Stripe products).
    const role = hasActive
      ? subsSnap.docs[0].data().role || 'pro'
      : null;

    const calcsSnap = await db
      .collection('calculators')
      .where('ownerUid', '==', uid)
      .get();

    if (calcsSnap.empty) {
      logger.info(`syncPlan: no calculators for ${uid}`);
      return;
    }

    const batch = db.batch();
    let touched = 0;

    calcsSnap.forEach((doc) => {
      const data = doc.data();
      if (hasActive) {
        if (data.plan !== role || data.active !== true) {
          batch.update(doc.ref, { plan: role, active: true });
          touched++;
        }
      } else if (data.plan !== 'free' && data.active !== false) {
        // Paid plan lapsed → the widget goes dark. Free-tier calculators are
        // untouched; they keep running with the badge.
        batch.update(doc.ref, { active: false });
        touched++;
      }
    });

    if (touched > 0) await batch.commit();
    logger.info(
      `syncPlan: uid=${uid} hasActive=${hasActive} role=${role} updated=${touched}`
    );
  }
);

exports.onLeadCreated = onDocumentCreated('leads/{leadId}', async (event) => {
  const lead = event.data && event.data.data();
  if (!lead || !lead.ownerUid) return;

  const settingsSnap = await db.doc(`settings/${lead.ownerUid}`).get();
  const settings = settingsSnap.exists ? settingsSnap.data() : null;
  if (!settings || !settings.leadAlerts || !settings.notifyEmail) return;

  const contact = lead.contact || {};
  const inputLines = Object.entries(lead.inputs || {})
    .map(([k, v]) => `<tr><td style="padding:2px 12px 2px 0;color:#6f695e">${escapeHtml(k)}</td><td>${escapeHtml(String(v))}</td></tr>`)
    .join('');

  await db.collection('mail').add({
    to: settings.notifyEmail,
    message: {
      subject: `New lead: ${contact.name || contact.email || 'someone'} — $${lead.result}`,
      html: [
        '<div style="font-family:system-ui,sans-serif;font-size:15px;color:#1b1916">',
        '<p><strong>A new lead just came in from your calculator.</strong></p>',
        '<table style="font-size:14px">',
        `<tr><td style="padding:2px 12px 2px 0;color:#6f695e">Name</td><td>${escapeHtml(contact.name || '—')}</td></tr>`,
        `<tr><td style="padding:2px 12px 2px 0;color:#6f695e">Email</td><td>${escapeHtml(contact.email || '—')}</td></tr>`,
        `<tr><td style="padding:2px 12px 2px 0;color:#6f695e">Phone</td><td>${escapeHtml(contact.phone || '—')}</td></tr>`,
        `<tr><td style="padding:2px 12px 2px 0;color:#6f695e">Quoted</td><td><strong>$${escapeHtml(String(lead.result))}</strong></td></tr>`,
        inputLines,
        `<tr><td style="padding:2px 12px 2px 0;color:#6f695e">Page</td><td>${escapeHtml(lead.page || '—')}</td></tr>`,
        '</table>',
        '<p style="color:#6f695e;font-size:13px">Reply directly to follow up. Manage alerts in your QuoteKit dashboard.</p>',
        '</div>',
      ].join(''),
    },
  });

  logger.info(`lead alert queued for ${lead.ownerUid}`);
});

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
