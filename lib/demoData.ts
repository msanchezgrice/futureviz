
import { Plan } from './types';
import { thisYear } from './util';

const y = thisYear();

export const demoPlan: Plan = {
  startYear: y,
  horizon: 50,
  people: [
    { id: 'self', name: 'You', birthYear: y - 35, role: 'self' },
    { id: 'partner', name: 'Partner', birthYear: y - 33, role: 'partner' },
    { id: 'kid1', name: 'Child 1', birthYear: y - 5, role: 'child', schoolStartAge: 5 },
    { id: 'kid2', name: 'Child 2', birthYear: y - 2, role: 'child', schoolStartAge: 5 }
  ],
  cityPlan: [
    { yearFrom: y, city: 'San Francisco' }
  ],
  finance: {
    startCumulative: 0,
    annualSavings: 0,
    growthPct: 0,
    oneOffs: []
  },
  experiences: [
    { kind: 'recurring', label: 'Family Vacation', everyNYears: 2, startYear: y + 1 }
  ],
  focus: [
    { decadeStart: y, work: 40, family: 40, health: 15, friends: 5 },
    { decadeStart: y + 10, work: 35, family: 35, health: 25, friends: 5 }
  ],
  journal: {}
};
