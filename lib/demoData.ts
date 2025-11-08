
import { Plan } from './types';
import { thisYear } from './util';

const y = thisYear();

export const demoPlan: Plan = {
  startYear: y,
  horizon: 20,
  people: [
    { id: 'self', name: 'You', birthYear: y - 42, role: 'self' },
    { id: 'partner', name: 'Partner', birthYear: y - 38, role: 'partner' },
    { id: 'kid1', name: 'Nikolai', birthYear: y - 5, role: 'child', schoolStartAge: 5 },
    { id: 'kid2', name: 'Baby', birthYear: y - 1, role: 'child', schoolStartAge: 5 }
  ],
  cityPlan: [
    { yearFrom: y, city: 'Austin' }
  ],
  finance: {
    startCumulative: 0,
    annualSavings: 120000,
    growthPct: 2,
    oneOffs: [
      { id: 'downpayment', year: y + 1, label: 'House Down Payment', amount: -250000 }
    ]
  },
  experiences: [
    { kind: 'recurring', label: 'Summer Abroad', everyNYears: 3, startYear: y + 1 }
  ],
  focus: [
    { decadeStart: y, work: 40, family: 40, health: 15, friends: 5 },
    { decadeStart: y + 10, work: 35, family: 35, health: 25, friends: 5 }
  ],
  journal: {}
};
