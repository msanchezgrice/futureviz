'use client';

import React from 'react';
import { Plan, Year } from '../lib/types';
import { computeYears, summarizeYear } from '../lib/calc';

type Props = {
  plan: Plan;
  isOpen: boolean;
  onClose: () => void;
  onGenerateTimeline: () => void;
};

export default function TimelineGallery({ plan, isOpen, onClose, onGenerateTimeline }: Props) {
  const years = computeYears(plan);
  const [currentYearIndex, setCurrentYearIndex] = React.useState(0);
  const currentYear = years[currentYearIndex];
  const currentImage = plan.timelineImages?.find(img => img.year === currentYear);
  const summary = summarizeYear(plan, currentYear);

  const hasImages = plan.timelineImages && plan.timelineImages.length > 0;

  if (!isOpen) return null;

  return (
    <div className="year-modal-overlay open" onClick={onClose}>
      <div className="year-modal" style={{ maxWidth: '1400px', height: '90vh' }} onClick={(e) => e.stopPropagation()}>
        <div className="year-modal-header">
          <h2>Your Timeline</h2>
          <button className="btn" onClick={onClose}>✕ Close</button>
        </div>

        {!hasImages ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '500px', gap: '24px' }}>
            <div style={{ textAlign: 'center', maxWidth: '600px' }}>
              <h3 style={{ fontSize: '24px', marginBottom: '16px' }}>See Your Future</h3>
              <p className="small" style={{ marginBottom: '24px', lineHeight: '1.6' }}>
                Generate AI-powered images for every year of your timeline ({years.length} years).
                Each image shows your family at the correct ages in your planned location,
                creating a visual journey through your future.
              </p>
              <button className="btn primary" style={{ fontSize: '16px', padding: '12px 24px' }} onClick={onGenerateTimeline}>
                ✨ See the Future ({years.length} images)
              </button>
              <p className="small" style={{ marginTop: '12px', opacity: 0.7 }}>
                This will take approximately {Math.ceil(years.length * 3 / 60)} minutes
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 80px)' }}>
            {/* Main Image Area */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', marginBottom: '24px' }}>
              {currentImage ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <img
                    src={currentImage.imageUrl}
                    alt={`Year ${currentYear}`}
                    style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: '12px', objectFit: 'contain' }}
                  />

                  {/* Navigation Arrows */}
                  {currentYearIndex > 0 && (
                    <button
                      className="carousel-nav prev"
                      onClick={() => setCurrentYearIndex(currentYearIndex - 1)}
                      style={{ position: 'absolute', left: '20px' }}
                    >
                      ←
                    </button>
                  )}
                  {currentYearIndex < years.length - 1 && (
                    <button
                      className="carousel-nav next"
                      onClick={() => setCurrentYearIndex(currentYearIndex + 1)}
                      style={{ position: 'absolute', right: '20px' }}
                    >
                      →
                    </button>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div className="small">No image generated for {currentYear}</div>
                </div>
              )}
            </div>

            {/* Year Info */}
            <div style={{ marginBottom: '16px', padding: '16px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ fontSize: '24px', fontWeight: 600 }}>{currentYear}</h3>
                <div className="small">{summary.city}</div>
              </div>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {plan.people.map(p => (
                  <div key={p.id} className="badge">
                    {p.name}: {summary.ages[p.id]} yrs
                  </div>
                ))}
              </div>
              {summary.milestones.length > 0 && (
                <div style={{ marginTop: '8px' }}>
                  <div className="small">{summary.milestones.join(' · ')}</div>
                </div>
              )}
            </div>

            {/* Timeline Slider */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="range"
                min={0}
                max={years.length - 1}
                value={currentYearIndex}
                onChange={(e) => setCurrentYearIndex(parseInt(e.target.value))}
                style={{ width: '100%' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                <div className="small">{years[0]}</div>
                <div className="small">{years[years.length - 1]}</div>
              </div>
            </div>

            {/* Thumbnail Strip */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              {years.map((year, idx) => {
                const img = plan.timelineImages?.find(ti => ti.year === year);
                return (
                  <div
                    key={year}
                    onClick={() => setCurrentYearIndex(idx)}
                    style={{
                      minWidth: '80px',
                      height: '80px',
                      borderRadius: '8px',
                      border: idx === currentYearIndex ? '2px solid var(--accent)' : '1px solid rgba(255,255,255,0.1)',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative'
                    }}
                  >
                    {img ? (
                      <img src={img.imageUrl} alt={`${year}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      <div className="small" style={{ fontSize: '10px' }}>{year}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
