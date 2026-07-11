// One entry = one generated landing page at /calculators/{slug}/ with a LIVE
// demo of that exact calculator. Add an entry, rebuild, and you've minted a
// new long-tail page. The `config` shape is identical to a Firestore
// calculator doc, so these double as copy-paste starting points.

const theme = { accent: '#CE4A12', radius: 14 };
const lead = (cta) => ({
  enabled: true,
  gate: true,
  fields: ['name', 'email', 'phone'],
  cta,
  successMessage: 'Got it — your full quote is on its way.',
});

export default [
  {
    slug: 'concrete-cost-calculator',
    name: 'Concrete',
    pageTitle: 'Concrete Cost Calculator for Your Website | QuoteKit',
    metaDescription:
      'Add a concrete cost calculator to your website with one script tag. Visitors get an instant driveway or slab estimate — you get the lead.',
    h1: 'Concrete cost calculator for your website',
    intro:
      'Homeowners searching "concrete driveway cost" want a number before they want a phone call. Put the number on your site — priced with your rates — and trade it for their contact details.',
    body: [
      'This calculator multiplies square footage by your per-foot rate, applies a finish multiplier for exposed aggregate or stamped work, and adds tear-out when they need old concrete removed. Every figure comes from constants you control in the dashboard, so a quote is never a promise you didn\'t make.',
      'When a visitor reveals their estimate, the lead lands in your dashboard with everything they entered: size, finish, tear-out, and the number they saw. Your follow-up call starts halfway done.',
    ],
    config: {
      title: 'Concrete Driveway Cost Calculator',
      plan: 'free',
      active: true,
      theme,
      fields: [
        { key: 'sqft', label: 'Driveway size (sq ft)', type: 'number', min: 50, max: 5000, step: 10, default: 400 },
        {
          key: 'finish', label: 'Finish', type: 'select',
          options: [
            { label: 'Broom finish', value: 1 },
            { label: 'Exposed aggregate', value: 1.25 },
            { label: 'Stamped & colored', value: 1.6 },
          ],
        },
        { key: 'removal', label: 'Remove existing concrete', type: 'checkbox', checkedValue: 1, uncheckedValue: 0 },
      ],
      formula: '(sqft * rate) * finish + removal * (sqft * tearout) + base_fee',
      constants: { rate: 6.5, tearout: 2.25, base_fee: 150 },
      result: { prefix: '$', decimals: 0, label: 'Estimated cost' },
      leadCapture: lead('Reveal my quote'),
    },
  },
  {
    slug: 'fence-installation-calculator',
    name: 'Fencing',
    pageTitle: 'Fence Installation Cost Calculator | QuoteKit',
    metaDescription:
      'Embed a fence installation calculator on your site. Linear feet, style, and gates — instant estimate for visitors, qualified lead for you.',
    h1: 'Fence installation cost calculator',
    intro:
      'Fence shoppers know two things: roughly how many feet they need, and that they hate waiting three days for a callback. Give them a number in ten seconds.',
    body: [
      'Price by linear foot with per-style rates for chain link, wood privacy, and vinyl, plus a flat rate per gate. Adjust any rate in the dashboard and every embedded calculator updates within minutes — no code changes on your site.',
      'Gate the result behind an email if you want harder leads, or show it instantly and offer to email a copy. Both modes write the full breakdown to your lead dashboard.',
    ],
    config: {
      title: 'Fence Installation Estimate',
      plan: 'free',
      active: true,
      theme: { accent: '#2B4C6F', radius: 10 },
      fields: [
        { key: 'feet', label: 'Linear feet', type: 'number', min: 10, max: 2000, step: 5, default: 120 },
        {
          key: 'style', label: 'Fence style', type: 'select',
          options: [
            { label: 'Chain link', value: 28 },
            { label: 'Wood privacy', value: 45, default: true },
            { label: 'Vinyl', value: 62 },
          ],
        },
        { key: 'gates', label: 'Number of gates', type: 'number', min: 0, max: 6, step: 1, default: 1 },
      ],
      formula: 'feet * style + gates * gate_price',
      constants: { gate_price: 350 },
      result: { prefix: '$', decimals: 0, label: 'Estimate' },
      leadCapture: { enabled: true, gate: false, fields: ['email', 'phone'], cta: 'Email me this quote', successMessage: 'Sent — check your inbox.' },
    },
  },
  {
    slug: 'roofing-cost-calculator',
    name: 'Roofing',
    pageTitle: 'Roofing Cost Calculator for Contractors | QuoteKit',
    metaDescription:
      'Add a roof replacement cost calculator to your website. Square footage, material, pitch, and tear-off — instant estimates that become leads.',
    h1: 'Roofing cost calculator',
    intro:
      'A roof is the biggest number most homeowners will ever hear from a contractor. Delivering it instantly — on your own site, at your own prices — is how you become the first call instead of the third quote.',
    body: [
      'The formula converts square footage to roofing squares, applies your per-square material rate for asphalt, metal, or tile, multiplies by a pitch factor for steep work, and adds tear-off when the old roof comes off.',
      'You will not win the job with the calculator. You will win the lead — with the exact roof size, material preference, and budget expectation attached.',
    ],
    config: {
      title: 'Roof Replacement Estimate',
      plan: 'free',
      active: true,
      theme,
      fields: [
        { key: 'sqft', label: 'Roof area (sq ft)', type: 'number', min: 500, max: 10000, step: 50, default: 1800 },
        {
          key: 'material', label: 'Material', type: 'select',
          options: [
            { label: 'Asphalt shingle', value: 450, default: true },
            { label: 'Metal', value: 725 },
            { label: 'Tile', value: 1100 },
          ],
        },
        {
          key: 'pitch', label: 'Roof pitch', type: 'select',
          options: [
            { label: 'Low / walkable', value: 1 },
            { label: 'Moderate', value: 1.15, default: true },
            { label: 'Steep', value: 1.35 },
          ],
        },
        { key: 'tearoff', label: 'Tear off existing roof', type: 'checkbox', checkedValue: 1, uncheckedValue: 0, default: true },
      ],
      formula: '(sqft / 100) * material * pitch + tearoff * tearoff_fee',
      constants: { tearoff_fee: 1500 },
      result: { prefix: '$', decimals: 0, label: 'Estimated cost' },
      leadCapture: lead('See my estimate'),
    },
  },
  {
    slug: 'interior-painting-cost-calculator',
    name: 'Painting',
    pageTitle: 'Interior Painting Cost Calculator | QuoteKit',
    metaDescription:
      'Put an interior painting cost calculator on your website. Wall area, coats, and prep work — instant quotes, captured leads.',
    h1: 'Interior painting cost calculator',
    intro:
      'Painting quotes are simple math dressed up as a site visit. Do the math on your website and save the site visits for people who\'ve already seen a number they like.',
    body: [
      'Wall area times your per-foot rate, a multiplier for a second coat, and a flat fee for patching and prep. Three inputs a homeowner can answer without a tape measure — accuracy comes from your rates, not their measuring.',
      'Because the result is gated behind an email, every quote this calculator gives out is a lead in your dashboard, not an anonymous tire-kicker.',
    ],
    config: {
      title: 'Interior Painting Cost Calculator',
      plan: 'free',
      active: true,
      theme,
      fields: [
        { key: 'sqft', label: 'Wall area (sq ft)', type: 'number', min: 100, max: 10000, step: 50, default: 1200 },
        {
          key: 'coats', label: 'Coats', type: 'select',
          options: [
            { label: 'One coat', value: 1 },
            { label: 'Two coats', value: 1.8, default: true },
          ],
        },
        { key: 'prep', label: 'Includes patching & prep', type: 'checkbox', checkedValue: 1, uncheckedValue: 0, default: true },
      ],
      formula: 'sqft * rate * coats + prep * prep_fee',
      constants: { rate: 3.25, prep_fee: 400 },
      result: { prefix: '$', decimals: 0, label: 'Estimated cost' },
      leadCapture: lead('See my quote'),
    },
  },
  {
    slug: 'kitchen-remodel-cost-calculator',
    name: 'Kitchen remodels',
    pageTitle: 'Kitchen Remodel Cost Calculator | QuoteKit',
    metaDescription:
      'Embed a kitchen remodel cost calculator. Size, finish grade, and island — realistic ranges that turn browsers into booked consultations.',
    h1: 'Kitchen remodel cost calculator',
    intro:
      'Nobody impulse-buys a kitchen. They research for weeks — and the contractor whose website answered "what will this cost?" is the one they remember when it\'s time to book a consultation.',
    body: [
      'Square footage times a per-foot rate for the finish grade they choose — budget, mid-range, or custom — plus a line item for an island. The output reads as a starting point, which is exactly what a remodel estimate should be.',
      'Set the grade rates to match your real project history and the calculator quietly pre-qualifies every lead: someone who saw the custom-grade number and still left a phone number is worth driving to.',
    ],
    config: {
      title: 'Kitchen Remodel Estimate',
      plan: 'free',
      active: true,
      theme,
      fields: [
        { key: 'sqft', label: 'Kitchen size (sq ft)', type: 'number', min: 50, max: 600, step: 10, default: 160 },
        {
          key: 'grade', label: 'Finish grade', type: 'select',
          options: [
            { label: 'Budget refresh', value: 90 },
            { label: 'Mid-range', value: 145, default: true },
            { label: 'Custom', value: 220 },
          ],
        },
        { key: 'island', label: 'Add an island', type: 'checkbox', checkedValue: 1, uncheckedValue: 0 },
      ],
      formula: 'sqft * grade + island * island_price',
      constants: { island_price: 4200 },
      result: { prefix: '$', decimals: 0, label: 'Estimated budget' },
      leadCapture: lead('Reveal my estimate'),
    },
  },
  {
    slug: 'landscaping-cost-calculator',
    name: 'Landscaping',
    pageTitle: 'Landscaping & Sod Cost Calculator | QuoteKit',
    metaDescription:
      'Add a landscaping cost calculator to your site. Yard size, sod or seed, and removal — instant estimates, leads with full context.',
    h1: 'Landscaping cost calculator',
    intro:
      'Yard projects get priced by the square foot, which means they can be quoted by a calculator — yours, on your site, before your competitor picks up the phone.',
    body: [
      'Square footage times your installed rate for sod or seed, plus optional removal of the existing lawn priced per foot. Swap the fields for mulch, pavers, or irrigation in the builder — the formula is yours to write.',
      'Every estimate captured includes the yard size and options chosen, so your crew can rough out the truck load before anyone drives to the property.',
    ],
    config: {
      title: 'Lawn & Sod Installation Estimate',
      plan: 'free',
      active: true,
      theme: { accent: '#2E7D32', radius: 14 },
      fields: [
        { key: 'sqft', label: 'Yard area (sq ft)', type: 'number', min: 200, max: 20000, step: 100, default: 2500 },
        {
          key: 'surface', label: 'Surface', type: 'select',
          options: [
            { label: 'Sod (installed)', value: 2.1, default: true },
            { label: 'Seed', value: 0.9 },
          ],
        },
        { key: 'removal', label: 'Remove existing lawn', type: 'checkbox', checkedValue: 1, uncheckedValue: 0 },
      ],
      formula: 'sqft * surface + removal * (sqft * removal_rate)',
      constants: { removal_rate: 0.8 },
      result: { prefix: '$', decimals: 0, label: 'Estimated cost' },
      leadCapture: lead('Email me this estimate'),
    },
  },
];
