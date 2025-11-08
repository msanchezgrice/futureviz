'use client';

import { Plan, Year, DayType, DayJournals } from '../lib/types';
import { summarizeYear } from '../lib/calc';
import React from 'react';

type Props = {
  plan: Plan;
  year?: Year;
  onClose: () => void;
  onSaveJournal: (year: Year, dayType: DayType, text: string) => void;
};

const DAY_TYPES: { type: DayType; label: string; emoji: string }[] = [
  { type: 'christmas', label: 'Christmas', emoji: '🎄' },
  { type: 'thanksgiving', label: 'Thanksgiving', emoji: '🦃' },
  { type: 'summer', label: 'Summer Day', emoji: '☀️' },
  { type: 'spring', label: 'Spring Day', emoji: '🌸' },
  { type: 'birthday', label: 'Birthday', emoji: '🎂' }
];

export default function YearDrawer({ plan, year, onClose, onSaveJournal }: Props) {
  if (!year) return null;
  const s = summarizeYear(plan, year);
  const people = plan.people;

  const [currentDayType, setCurrentDayType] = React.useState<DayType>('christmas');
  const [text, setText] = React.useState<string>('');
  const [generatedImages, setGeneratedImages] = React.useState<Array<{imageUrl: string, sceneDescription: string, index: number}>>([]);
  const [currentImageIndex, setCurrentImageIndex] = React.useState(0);
  const [isGeneratingImage, setIsGeneratingImage] = React.useState(false);
  const [imageError, setImageError] = React.useState<string | null>(null);

  // Update text when year or day type changes
  React.useEffect(() => {
    const dayJournals = plan.journal[year] || {};
    setText(dayJournals[currentDayType] ?? '');
    setGeneratedImages([]);
    setCurrentImageIndex(0);
    setImageError(null);
  }, [year, currentDayType, plan.journal]);

  const handleGenerateImages = async () => {
    setIsGeneratingImage(true);
    setImageError(null);
    try {
      const res = await fetch('/api/generate-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          year,
          dayComposerText: text,
          characterDescriptions: plan.characterDescriptions, // Pass character descriptions for consistency
          context: {
            summary: s,
            people: plan.people,
            cityPlan: plan.cityPlan
          }
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate images');
      }
      setGeneratedImages(data.images || []);
      setCurrentImageIndex(0);
    } catch (err: any) {
      setImageError(err.message || 'Failed to generate images');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % generatedImages.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + generatedImages.length) % generatedImages.length);
  };

  return (
    <div className={'year-modal-overlay ' + (year ? 'open' : '')} onClick={onClose}>
      <div className="year-modal" onClick={(e) => e.stopPropagation()}>
        <div className="year-modal-header">
          <h2>{year}</h2>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>

        {/* Year Overview */}
        <div style={{ marginBottom: '24px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div>
            <div className="small">Location</div>
            <div style={{ fontSize: '18px', fontWeight: 500 }}>{s.city ?? 'Unknown'}</div>
          </div>
          <div>
            <div className="small">Savings</div>
            <div style={{ fontSize: '18px', fontWeight: 500 }}>${s.savingsCumulative.toLocaleString()}</div>
          </div>
          <div style={{ flex: 1 }}>
            <div className="small">Family</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', flexWrap: 'wrap' }}>
              {people.map(p => (
                <div key={p.id} className="badge" style={{ padding: '4px 12px' }}>
                  {p.name}: {s.ages[p.id]} yrs
                </div>
              ))}
            </div>
          </div>
        </div>

        {s.moments.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <div className="sectionTitle">Moments</div>
            <div className="small">{s.moments.join(' · ')}</div>
          </div>
        )}

        {/* Main Content: Day Composer + Vision Board */}
        <div className="year-modal-content">
          {/* Left: Day Composer */}
          <div className="composer-section">
            <div>
              <div className="sectionTitle">Day Composer</div>

              {/* Day Type Carousel */}
              <div style={{ marginBottom: '16px' }}>
                <div className="small" style={{ marginBottom: '8px' }}>Select a day to compose:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {DAY_TYPES.map(dt => (
                    <button
                      key={dt.type}
                      className={'btn' + (currentDayType === dt.type ? ' primary' : '')}
                      onClick={() => setCurrentDayType(dt.type)}
                      style={{ padding: '8px 16px' }}
                    >
                      {dt.emoji} {dt.label}
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                className="editor"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder={`Write a vivid ${DAY_TYPES.find(d => d.type === currentDayType)?.label} day-in-the-life for ${year}...`}
              />
              <div className="editor-actions">
                <button className="btn primary" onClick={() => onSaveJournal(year, currentDayType, text)}>
                  Save {DAY_TYPES.find(d => d.type === currentDayType)?.emoji}
                </button>
                <button className="btn" onClick={async () => {
                  const res = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      year,
                      dayType: currentDayType,
                      context: { summary: s, people: plan.people, cityPlan: plan.cityPlan }
                    })
                  });
                  const j = await res.json();
                  setText((j.text || '') + '\n\n' + text);
                }}>
                  Generate This Day
                </button>
                <button className="btn" style={{ background: 'rgba(52,211,153,0.2)' }} onClick={async () => {
                  const res = await fetch('/api/ai', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      year,
                      generateAll: true,
                      context: { summary: s, people: plan.people, cityPlan: plan.cityPlan }
                    })
                  });
                  const j = await res.json();
                  if (j.allDayTexts) {
                    // Save all 5 day types at once
                    const yearJournals = plan.journal[year] || {};
                    const updatedJournals = { ...yearJournals };
                    Object.keys(j.allDayTexts).forEach(dt => {
                      updatedJournals[dt as DayType] = j.allDayTexts[dt];
                    });
                    // Update the plan directly
                    const updatedPlan = {
                      ...plan,
                      journal: {
                        ...plan.journal,
                        [year]: updatedJournals
                      }
                    };
                    // Save to parent
                    Object.keys(j.allDayTexts).forEach(dt => {
                      onSaveJournal(year, dt as DayType, j.allDayTexts[dt]);
                    });
                    // Update local text for current day
                    setText(j.allDayTexts[currentDayType] || text);
                  }
                }}>
                  ✨ Generate All 5 Days
                </button>
              </div>
              <div className="small">OpenAI generates {DAY_TYPES.find(d => d.type === currentDayType)?.label.toLowerCase()} vignettes</div>
            </div>
          </div>

          {/* Right: Vision Board */}
          <div className="vision-section">
            <div>
              <div className="sectionTitle">Vision Board</div>
              <div className="small" style={{ marginBottom: '12px' }}>
                {text
                  ? `5 photorealistic scenes from different moments of your ${DAY_TYPES.find(d => d.type === currentDayType)?.label}`
                  : `Generate 5 aspirational images for a ${DAY_TYPES.find(d => d.type === currentDayType)?.label.toLowerCase()} in ${year}`}
              </div>

              {generatedImages.length > 0 ? (
                <div className="image-carousel">
                  <div className="carousel-main-image">
                    <img
                      src={generatedImages[currentImageIndex].imageUrl}
                      alt={`Vision ${currentImageIndex + 1} for year ${year}`}
                    />
                    {generatedImages.length > 1 && (
                      <>
                        <button
                          className="carousel-nav prev"
                          onClick={prevImage}
                          disabled={generatedImages.length <= 1}
                        >
                          ←
                        </button>
                        <button
                          className="carousel-nav next"
                          onClick={nextImage}
                          disabled={generatedImages.length <= 1}
                        >
                          →
                        </button>
                        <div className="carousel-counter">
                          {currentImageIndex + 1} / {generatedImages.length}
                        </div>
                      </>
                    )}
                  </div>

                  {generatedImages[currentImageIndex].sceneDescription && (
                    <div className="scene-description">
                      {generatedImages[currentImageIndex].sceneDescription}
                    </div>
                  )}

                  {generatedImages.length > 1 && (
                    <div className="carousel-thumbnails">
                      {generatedImages.map((img, idx) => (
                        <div
                          key={idx}
                          className={'carousel-thumbnail ' + (idx === currentImageIndex ? 'active' : '')}
                          onClick={() => setCurrentImageIndex(idx)}
                        >
                          <img src={img.imageUrl} alt={`Scene ${idx + 1}`} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="generated-image-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div className="small">No images generated yet</div>
                </div>
              )}

              {imageError && (
                <div className="small" style={{ color: 'var(--danger)', marginTop: '8px' }}>
                  Error: {imageError}
                </div>
              )}

              <button
                className="btn primary"
                onClick={handleGenerateImages}
                disabled={isGeneratingImage}
                style={{ width: '100%', marginTop: '12px' }}
              >
                {isGeneratingImage ? 'Generating 5 Visions... (30-40s)' : '✨ Generate 5 Vision Images'}
              </button>
              <div className="small" style={{ marginTop: '8px' }}>
                Gemini creates 5 photorealistic scenes from different moments
                {!plan.characterDescriptions && (
                  <span style={{ display: 'block', marginTop: '4px', color: 'var(--accent)' }}>
                    💡 Tip: Upload family photos in Settings for better character consistency
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
