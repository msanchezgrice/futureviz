'use client';

import { Plan, Person } from '../lib/types';
import { computeYears, ageIn, childStage, summarizeYear } from '../lib/calc';
import React from 'react';

type Props = {
  plan: Plan;
  onSelectYear: (y: number) => void;
};

export default function YearCards({ plan, onSelectYear }: Props) {
  const years = computeYears(plan);

  return (
    <div className="year-cards">
      {years.map((year) => {
        const summary = summarizeYear(plan, year);

        // Get key life events for this year - expanded milestones
        const milestones = plan.people
          .map(p => {
            const age = ageIn(p, year);
            if (p.role === 'child') {
              const stage = childStage(age, p.schoolStartAge ?? 5);
              // Major life milestones
              if (age === 0) return `🍼 ${p.name} born`;
              if (stage === 'K' && age === (p.schoolStartAge ?? 5)) return `🎒 ${p.name} starts K`;
              if (age === 6) return `📚 ${p.name} starts 1st grade`;
              if (age === 13) return `🎓 ${p.name} starts high school`;
              if (age === 16) return `🚗 ${p.name} driving age`;
              if (age === 18) return `🎓 ${p.name} graduates HS`;
              if (age === 22) return `🎓 ${p.name} graduates college`;
              if (age === 21) return `🎉 ${p.name} turns 21`;
              // Sweet 16
              if (age === 16) return `🎂 ${p.name} sweet 16`;
            }
            // Milestone ages for adults
            if (age === 30) return `🎂 ${p.name} turns 30`;
            if (age === 40) return `🎂 ${p.name} turns 40`;
            if (age === 50) return `🎉 ${p.name} turns 50`;
            if (age === 60) return `🎉 ${p.name} turns 60`;
            if (age === 65) return `🏖️ ${p.name} retirement age`;
            if (age === 70) return `🎂 ${p.name} turns 70`;
            return null;
          })
          .filter(Boolean);

        return (
          <div key={year} className="year-card" onClick={() => onSelectYear(year)}>
            <div className="year-number">{year}</div>
            {summary.city && <div className="year-info">{summary.city}</div>}
            {plan.people.map(p => {
              const age = ageIn(p, year);
              return (
                <div key={p.id} className="year-info">
                  {p.name}: {age}
                </div>
              );
            })}
            {milestones.length > 0 && (
              <div className="milestone-badge">
                {milestones[0]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
