'use client';

import React from 'react';
import './globals.css';
import InputForm from '../components/InputForm';
import YearCards from '../components/YearCards';
import dynamic from 'next/dynamic';
import YearDrawer from '../components/YearDrawer';
import TimelineGallery from '../components/TimelineGallery';
import { Plan } from '../lib/types';
import { demoPlan } from '../lib/demoData';
import { computeYears, summarizeYear } from '../lib/calc';

const MoneyStrip = dynamic(() => import('../components/MoneyStrip'), { ssr: false });

export default function Page() {
  const [plan, setPlan] = React.useState<Plan>(demoPlan);
  const [selectedYear, setSelectedYear] = React.useState<number | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const [timelineOpen, setTimelineOpen] = React.useState(false);
  const [isGeneratingTimeline, setIsGeneratingTimeline] = React.useState(false);

  // Load from localStorage only on client side after hydration
  React.useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      const saved = window.localStorage.getItem('futureline.plan');
      if (saved) {
        try {
          setPlan(JSON.parse(saved) as Plan);
        } catch(e) {
          console.error('Failed to load saved plan:', e);
        }
      }
    }
  }, []);

  // Save to localStorage (only after client hydration)
  React.useEffect(() => {
    if (!isClient) return; // Don't save until after initial load from localStorage

    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem('futureline.plan', JSON.stringify(plan));
      } catch (err: any) {
        if (err.name === 'QuotaExceededError') {
          console.error('localStorage quota exceeded. Your plan is too large to save.');
          // Optionally show a toast/notification to the user
          alert('Warning: Your plan is too large to save automatically. Consider removing some photos to reduce size. Your changes will be lost when you refresh the page.');
        } else {
          console.error('Failed to save plan:', err);
        }
      }
    }
  }, [plan, isClient]);

  const handleGenerateTimeline = async () => {
    setIsGeneratingTimeline(true);
    try {
      const years = computeYears(plan);
      const yearsData = years.map(year => ({
        year,
        summary: summarizeYear(plan, year)
      }));

      const response = await fetch('/api/generate-timeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          years: yearsData,
          characterDescriptions: plan.characterDescriptions,
          people: plan.people,
          cityPlan: plan.cityPlan
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate timeline');
      }

      const { timelineImages } = await response.json();
      setPlan({ ...plan, timelineImages });
    } catch (err) {
      console.error('Timeline generation failed:', err);
      alert('Failed to generate timeline images. Please try again.');
    } finally {
      setIsGeneratingTimeline(false);
    }
  };

  return (
    <div className="container">
      <div className="header">
        <div className="logo">
          <img src="/favicon.svg" width={26} height={26} alt="logo" />
          <span>Futureline</span>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn" onClick={() => setTimelineOpen(true)}>
            🎬 Open Timeline
          </button>
          <button className="btn" onClick={() => setSettingsOpen(!settingsOpen)}>
            {settingsOpen ? '✕ Close Settings' : '⚙ Settings'}
          </button>
        </div>
      </div>

      {/* Collapsible Settings Panel */}
      {settingsOpen && (
        <div className="settings-panel">
          <InputForm plan={plan} onChange={setPlan} />
        </div>
      )}

      {/* Year Cards */}
      <div>
        <h3 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 600 }}>
          Your Timeline
        </h3>
        <YearCards plan={plan} onSelectYear={setSelectedYear} />
      </div>

      {/* Savings Chart */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ marginBottom: '16px', fontSize: '20px', fontWeight: 600 }}>
          Savings Over Time
        </h3>
        <MoneyStrip plan={plan} />
      </div>

      <div className="footer">All data is local to your browser in MVP. Optional AI uses your own API key.</div>

      <YearDrawer
        plan={plan}
        year={selectedYear}
        onClose={() => setSelectedYear(undefined)}
        onSaveJournal={(year, dayType, text) => {
          const yearJournals = plan.journal[year] || {};
          setPlan({
            ...plan,
            journal: {
              ...plan.journal,
              [year]: { ...yearJournals, [dayType]: text }
            }
          });
        }}
      />

      <TimelineGallery
        plan={plan}
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        onGenerateTimeline={handleGenerateTimeline}
      />
    </div>
  );
}
