'use client';

import dynamic from 'next/dynamic';
import React from 'react';
import { Plan } from '../lib/types';
import { computeYears, summarizeYear } from '../lib/calc';

const Recharts = {
  LineChart: dynamic(() => import('recharts').then(m => m.LineChart as any), { ssr: false }),
  Line: dynamic(() => import('recharts').then(m => m.Line as any), { ssr: false }),
  XAxis: dynamic(() => import('recharts').then(m => m.XAxis as any), { ssr: false }),
  YAxis: dynamic(() => import('recharts').then(m => m.YAxis as any), { ssr: false }),
  Tooltip: dynamic(() => import('recharts').then(m => m.Tooltip as any), { ssr: false }),
  CartesianGrid: dynamic(() => import('recharts').then(m => m.CartesianGrid as any), { ssr: false }),
  ResponsiveContainer: dynamic(() => import('recharts').then(m => m.ResponsiveContainer as any), { ssr: false }),
  Scatter: dynamic(() => import('recharts').then(m => m.Scatter as any), { ssr: false }),
  ScatterChart: dynamic(() => import('recharts').then(m => m.ScatterChart as any), { ssr: false })
};

type Props = { plan: Plan };

export default function MoneyStrip({ plan }: Props) {
  const [mounted, setMounted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    console.log('[MoneyStrip] Mounting...');
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="card" style={{height:280}}>
        <div className="sectionTitle">Savings (cumulative)</div>
        <div style={{width:'100%', height:220, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="small">Loading chart...</div>
        </div>
      </div>
    );
  }

  const years = computeYears(plan);
  const data = years.map(y => ({
    year: y,
    savings: summarizeYear(plan, y).savingsCumulative
  }));

  console.log('[MoneyStrip] Years:', years.length, 'Data points:', data.length);
  console.log('[MoneyStrip] Sample data:', data.slice(0, 3));

  const oneOffPoints = plan.finance.oneOffs.map(o => ({
    year: o.year, savings: summarizeYear(plan, Math.max(plan.startYear, Math.min(plan.startYear + plan.horizon, o.year))).savingsCumulative, label: o.label, amount: o.amount
  }));

  const { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Scatter, ScatterChart } = Recharts as any;

  console.log('[MoneyStrip] Recharts components loaded:', {
    LineChart: !!LineChart,
    ResponsiveContainer: !!ResponsiveContainer
  });

  return (
    <div className="card" style={{height:280}}>
      <div className="sectionTitle">Savings (cumulative)</div>
      <div style={{width:'100%', height:220}}>
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: 12, right: 12, top: 10, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.08)" />
              <XAxis dataKey="year" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" tickFormatter={(v:number)=>`$${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(v:any)=>[`$${Number(v).toLocaleString()}`, 'Savings']} labelFormatter={(l:any)=>`Year ${l}`} />
              <Line type="monotone" dataKey="savings" dot={false} stroke="#60a5fa" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%'}}>
            <div className="small">No data to display</div>
          </div>
        )}
      </div>
      <div className="small">One‑offs (costs/credits): {plan.finance.oneOffs.length ? plan.finance.oneOffs.map(o => `${o.label} ${o.year} (${o.amount < 0 ? '-' : '+'}$${Math.abs(o.amount).toLocaleString()})`).join(' · ') : 'none'}</div>
    </div>
  );
}
