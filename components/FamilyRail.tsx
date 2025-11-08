'use client';

import { Plan, Person } from '../lib/types';
import { computeYears, ageIn, childStage } from '../lib/calc';
import React from 'react';

type Props = {
  plan: Plan;
  onSelectYear: (y: number) => void;
};

function stageClass(p: Person, age: number): string {
  if (p.role !== 'child') return 'stage-adult';
  const label = childStage(age, p.schoolStartAge ?? 5);
  if (label === 'Infant') return 'stage-infant';
  if (label === 'Pre-K') return 'stage-prek';
  if (label === 'K') return 'stage-k';
  if (label === 'Adult') return 'stage-adult';
  return 'stage-grade';
}

function stageLabel(p: Person, age: number): string | null {
  if (p.role !== 'child') return null;
  const s = childStage(age, p.schoolStartAge ?? 5);
  return s;
}

export default function FamilyRail({ plan, onSelectYear }: Props) {
  const years = computeYears(plan);

  return (
    <div className="card timeline">
      <table>
        <thead>
          <tr>
            <th className="cell">Person</th>
            {years.map((y) => (
              <th key={y} className="cell">{y}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {plan.people.map((p) => (
            <tr key={p.id}>
              <th className="cell">{p.name}</th>
              {years.map((y) => {
                const a = ageIn(p, y);
                const s = stageLabel(p, a);
                const c = `cell ${stageClass(p, a)}`;
                return (
                  <td key={y} className={c} onClick={() => onSelectYear(y)} style={{cursor:'pointer'}}>
                    <span>{a}</span>
                    {s && <span className="tag">{s}</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
