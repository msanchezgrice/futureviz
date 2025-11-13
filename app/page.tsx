'use client';

import React from 'react';
import './globals.css';
import InputForm from '../components/InputForm';
import YearCards from '../components/YearCards';
import YearDrawer from '../components/YearDrawer';
import TimelineGallery from '../components/TimelineGallery';
import VisionGallery from '../components/VisionGallery';
import { Plan } from '../lib/types';
import { demoPlan } from '../lib/demoData';
import { computeYears, summarizeYear } from '../lib/calc';

export default function Page() {
  const [plan, setPlan] = React.useState<Plan>(demoPlan);
  const [selectedYear, setSelectedYear] = React.useState<number | undefined>(undefined);
  const [settingsOpen, setSettingsOpen] = React.useState(false);
  const [isClient, setIsClient] = React.useState(false);
  const [timelineOpen, setTimelineOpen] = React.useState(false);
  const [isGeneratingTimeline, setIsGeneratingTimeline] = React.useState(false);
  const [generationProgress, setGenerationProgress] = React.useState<{ current: number; total: number } | undefined>(undefined);

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
  // Exclude timeline images and vision board images to prevent quota exceeded errors
  React.useEffect(() => {
    if (!isClient) return; // Don't save until after initial load from localStorage

    if (typeof window !== 'undefined') {
      try {
        // Save plan without large images (they can be regenerated)
        const { timelineImages, visionBoardImages, ...planWithoutImages } = plan;

        // Also limit family photos to prevent quota issues
        const planToSave = {
          ...planWithoutImages,
          familyPhotos: planWithoutImages.familyPhotos?.slice(0, 5) // Only keep first 5 photos
        };

        const jsonString = JSON.stringify(planToSave);
        console.log(`[localStorage] Saving plan: ${(jsonString.length / 1024).toFixed(1)} KB`);

        window.localStorage.setItem('futureline.plan', jsonString);
      } catch (err: any) {
        if (err.name === 'QuotaExceededError') {
          console.error('localStorage quota exceeded. Your plan is too large to save.');
          // Try saving without family photos at all
          try {
            const { timelineImages, visionBoardImages, familyPhotos, ...planMinimal } = plan;
            window.localStorage.setItem('futureline.plan', JSON.stringify(planMinimal));
            alert('Warning: Your plan has too many photos. Only settings and text saved. Photos will be lost on refresh.');
          } catch {
            alert('Critical: Cannot save your plan. Please remove photos and refresh.');
          }
        } else {
          console.error('Failed to save plan:', err);
        }
      }
    }
  }, [plan, isClient]);

  const handleGenerateTimeline = async () => {
    setIsGeneratingTimeline(true);
    setGenerationProgress({ current: 0, total: 0 });

    try {
      const years = computeYears(plan);
      setGenerationProgress({ current: 0, total: years.length });

      const yearsData = years.map(year => ({
        year,
        summary: summarizeYear(plan, year)
      }));

      // Generate images one by one to track progress
      const timelineImages: any[] = [];
      for (let i = 0; i < yearsData.length; i++) {
        const yearData = yearsData[i];
        setGenerationProgress({ current: i + 1, total: years.length });

        try {
          const response = await fetch('/api/generate-timeline', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              years: [yearData], // Generate one year at a time
              characterDescriptions: plan.characterDescriptions,
              people: plan.people,
              cityPlan: plan.cityPlan
            })
          });

          if (response.ok) {
            const { timelineImages: newImages } = await response.json();
            timelineImages.push(...newImages);
            // Update plan with progress
            setPlan(prev => ({ ...prev, timelineImages: [...timelineImages] }));
          }
        } catch (err) {
          console.error(`Failed to generate image for year ${yearData.year}:`, err);
          // Continue with next year
        }
      }
    } catch (err) {
      console.error('Timeline generation failed:', err);
      alert('Failed to generate timeline images. Please try again.');
    } finally {
      setIsGeneratingTimeline(false);
      setGenerationProgress(undefined);
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
          <button
            className="btn"
            onClick={() => {
              if (confirm('Clear all timeline images and regenerate from scratch? (Your day texts and settings will be preserved)')) {
                setPlan(prev => ({ ...prev, timelineImages: [] }));
                alert('Timeline cache cleared! Click "See the Future" to regenerate.');
              }
            }}
            title="Clear timeline image cache"
          >
            🗑️ Clear Cache
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

      {/* Vision Gallery */}
      <VisionGallery plan={plan} />

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
        onSaveAllDayJournals={(year, allDayTexts) => {
          // Save all day types in a single state update to avoid race condition
          const yearJournals = plan.journal[year] || {};
          setPlan({
            ...plan,
            journal: {
              ...plan.journal,
              [year]: { ...yearJournals, ...allDayTexts }
            }
          });
        }}
        onSaveVisionImages={(year, dayType, images) => {
          console.log(`[page.tsx] Saving vision images for ${year} ${dayType}, ${images.length} images`);
          const existing = plan.visionBoardImages || [];
          const filtered = existing.filter(vb => !(vb.year === year && vb.dayType === dayType));
          const newVisionBoards = [
            ...filtered,
            { year, dayType, images, generatedAt: Date.now() }
          ];
          console.log(`[page.tsx] Total vision boards after save:`, newVisionBoards.length);
          setPlan({
            ...plan,
            visionBoardImages: newVisionBoards
          });
        }}
      />

      <TimelineGallery
        plan={plan}
        isOpen={timelineOpen}
        onClose={() => setTimelineOpen(false)}
        onGenerateTimeline={handleGenerateTimeline}
        isGenerating={isGeneratingTimeline}
        generationProgress={generationProgress}
      />
    </div>
  );
}
