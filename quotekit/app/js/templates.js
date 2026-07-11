// Starter templates offered by the "New calculator" menu. Each `calc` is a
// complete widget config; the dashboard fills in ownerUid/plan/timestamps.

export const TEMPLATES = [
  {
    id: 'blank',
    name: 'Blank calculator',
    hint: 'Start from scratch',
    calc: {
      title: 'Instant quote',
      fields: [
        { key: 'quantity', label: 'Quantity', type: 'number', min: 1, max: 1000, step: 1, default: 10 },
      ],
      formula: 'quantity * rate',
      constants: { rate: 25 },
      result: { prefix: '$', suffix: '', decimals: 0, label: 'Estimate' },
      leadCapture: {
        enabled: true,
        gate: false,
        fields: ['name', 'email'],
        cta: 'Email me this quote',
        successMessage: 'Thanks — your quote is on its way.',
      },
      theme: { accent: '#CE4A12', radius: 14 },
    },
  },
  {
    id: 'concrete',
    name: 'Concrete driveway',
    hint: 'Sq ft × rate × finish + tear-out',
    calc: {
      title: 'Concrete Driveway Cost Calculator',
      fields: [
        { key: 'sqft', label: 'Driveway size (sq ft)', type: 'number', min: 50, max: 5000, step: 10, default: 400 },
        {
          key: 'finish',
          label: 'Finish',
          type: 'select',
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
      result: { prefix: '$', suffix: '', decimals: 0, label: 'Estimated cost' },
      leadCapture: {
        enabled: true,
        gate: true,
        fields: ['name', 'email', 'phone'],
        cta: 'Reveal my quote',
        successMessage: 'Got it — your full quote is in your inbox.',
      },
      theme: { accent: '#CE4A12', radius: 14 },
    },
  },
  {
    id: 'fence',
    name: 'Fence installation',
    hint: 'Linear feet × style + gates',
    calc: {
      title: 'Fence Installation Estimate',
      fields: [
        { key: 'feet', label: 'Linear feet', type: 'number', min: 10, max: 2000, step: 5, default: 120 },
        {
          key: 'style',
          label: 'Fence style',
          type: 'select',
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
      result: { prefix: '$', suffix: '', decimals: 0, label: 'Estimate' },
      leadCapture: {
        enabled: true,
        gate: false,
        fields: ['email', 'phone'],
        cta: 'Email me this quote',
        successMessage: 'Thanks — your estimate is on its way.',
      },
      theme: { accent: '#2B4C6F', radius: 10 },
    },
  },
  {
    id: 'painting',
    name: 'Interior painting',
    hint: 'Sq ft × rate × coats + prep',
    calc: {
      title: 'Interior Painting Cost Calculator',
      fields: [
        { key: 'sqft', label: 'Wall area (sq ft)', type: 'number', min: 100, max: 10000, step: 50, default: 1200 },
        {
          key: 'coats',
          label: 'Coats',
          type: 'select',
          options: [
            { label: 'One coat', value: 1 },
            { label: 'Two coats', value: 1.8, default: true },
          ],
        },
        { key: 'prep', label: 'Includes patching & prep', type: 'checkbox', checkedValue: 1, uncheckedValue: 0, default: true },
      ],
      formula: 'sqft * rate * coats + prep * prep_fee',
      constants: { rate: 3.25, prep_fee: 400 },
      result: { prefix: '$', suffix: '', decimals: 0, label: 'Estimated cost' },
      leadCapture: {
        enabled: true,
        gate: true,
        fields: ['name', 'email'],
        cta: 'See my quote',
        successMessage: 'Done — check your inbox for the full quote.',
      },
      theme: { accent: '#CE4A12', radius: 14 },
    },
  },
];
