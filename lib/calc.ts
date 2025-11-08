
import { CityPlan, FinancePlan, Person, Plan, Year, YearSummary } from './types';

export function range(start: number, end: number): number[] {
  const arr: number[] = [];
  for (let i = start; i <= end; i++) arr.push(i);
  return arr;
}

export function ageIn(person: Person, year: Year): number {
  return year - person.birthYear;
}

export function childStage(age: number, startAge = 5): 'Infant' | 'Pre-K' | 'K' | `G${number}` | 'Adult' | 'Post-K' {
  if (age <= 2) return 'Infant';
  if (age <= 4) return 'Pre-K';
  if (age === startAge) return 'K';
  if (age > startAge && age <= startAge + 12) return (`G${age - startAge}` as any);
  return age < 18 ? 'Post-K' : 'Adult';
}

export function cityIn(cityPlan: CityPlan[], year: Year): string | undefined {
  let city: string | undefined = undefined;
  for (const c of cityPlan) {
    const to = c.yearTo ?? 9999;
    if (year >= c.yearFrom && year <= to) {
      city = c.city;
    }
  }
  return city;
}

export function cumulativeSavings(plan: FinancePlan, year: Year, startYear: Year): number {
  let acc = plan.startCumulative ?? 0;
  const step = (y: number) => {
    const growth = plan.growthPct ? acc * (plan.growthPct / 100) : 0;
    const oneOff = plan.oneOffs.filter(o => o.year === y).reduce((s, o) => s + o.amount, 0);
    acc = acc + plan.annualSavings + growth + oneOff;
  };
  for (let y = startYear; y <= year; y++) step(y);
  return acc;
}

export function summarizeYear(plan: Plan, year: Year): YearSummary {
  const ages: Record<string, number> = {};
  plan.people.forEach(p => ages[p.id] = ageIn(p, year));
  const savingsCumulative = cumulativeSavings(plan.finance, year, plan.startYear);
  const city = cityIn(plan.cityPlan, year);
  const milestones: string[] = [];
  Object.values(ages).forEach(a => {
    if (a === 5 || a === 13 || a === 16 || a === 18 || a % 10 === 0) milestones.push(`${a}`);
  });
  const moments: string[] = [];
  if (plan.experiences) {
    for (const e of plan.experiences) {
      if ('year' in e) {
        if (e.year === year) moments.push(e.label);
      } else {
        if (year >= e.startYear && (year - e.startYear) % e.everyNYears === 0) moments.push(e.label);
      }
    }
  }
  return { year, ages, city, savingsCumulative, milestones, moments };
}

export function computeYears(plan: Plan): Year[] {
  return range(plan.startYear, plan.startYear + plan.horizon);
}
