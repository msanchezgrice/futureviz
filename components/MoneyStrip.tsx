'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Plan } from '../lib/types';
import { computeYears, summarizeYear } from '../lib/calc';

const Recharts = {
  LineChart: dynamic(() => import('recharts').then(m => m.LineChart), { ssr: false }),
  Line: dynamic(() => import('recharts').then(m => m.Line), { ssr: false }),
  XAxis: dynamic(() => import('recharts').then(m => m.XAxis), { ssr: false }),
  YAxis: dynamic(() => import('recharts').then(m => m.YAxis), { ssr: false }),
  Tooltip: dynamic(() => import('recharts').then(m => m.Tooltip), { ssr: false }),
  CartesianGrid: dynamic(() => import('recharts').then(m => m.CartesianGrid), { ssr: false }),
  ResponsiveContainer: dynamic(() => import('recharts').then(m => m.ResponsiveContainer), { ssr: false }),
  Scatter: dynamic(() => import('recharts').then(m => m.Scatter), { ssr: false }),
  ScatterChart: dynamic(() => import('recharts').then(m => m.ScatterChart), { ssr: false })
};

type Props = { plan: Plan };

export default function MoneyStrip({ plan }: Props) {
  const years = computeYears(plan);
  const data = years.map(y => ({
    year: y,
    savings: summarizeYear(plan, y).savingsCumulative
  }));

  const oneOffPoints = plan.finance.oneOffs.map(o => ({
    year: o.year, savings: summarizeYear(plan, Math.max(plan.startYear, Math.min(plan.startYear + plan.horizon, o.year))).savingsCumulative, label: o.label, amount: o.amount
  }));

  const { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart } = Recharts as any;

  return (
    <div className="card" style={{height:280}}>
      <div className="sectionTitle">Savings (cumulative)</div>
      <div style={{width:'100%', height:220}}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="year" stroke="#94a3b8" />
            <YAxis stroke="#94a3b8" tickFormatter={(v:number)=>`$${(v/1000).toFixed(0)}k`} />
            <Tooltip formatter={(v:any)=>[`$${Number(v).toLocaleString()}`, 'Savings']} labelFormatter={(l:any)=>`Year ${l}`} />
            <Line type="monotone" dataKey="savings" dot={false} stroke="#60a5fa" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="small">One‑offs (costs/credits): {plan.finance.oneOffs.length ? plan.finance.oneOffs.map(o => `${o.label} ${o.year} (${o.amount < 0 ? '-' : '+'}$${Math.abs(o.amount).toLocaleString()})`).join(' · ') : 'none'}</div>
    </div>
  );
}
