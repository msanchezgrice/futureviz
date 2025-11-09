'use client';

import { Plan, VisionBoardImages, DayType } from '../lib/types';
import React from 'react';

type Props = {
  plan: Plan;
};

const DAY_TYPE_LABELS: Record<DayType, string> = {
  christmas: 'Christmas',
  thanksgiving: 'Thanksgiving',
  summer: 'Summer Day',
  spring: 'Spring Day',
  birthday: 'Birthday'
};

export default function VisionGallery({ plan }: Props) {
  const [selectedImage, setSelectedImage] = React.useState<{ imageUrl: string; description: string; year: number; dayType: DayType } | null>(null);

  React.useEffect(() => {
    console.log('VisionGallery: visionBoardImages count:', plan.visionBoardImages?.length || 0);
    if (plan.visionBoardImages) {
      console.log('VisionGallery: Years with images:', plan.visionBoardImages.map(vb => `${vb.year} (${vb.dayType})`));
    }
  }, [plan.visionBoardImages]);

  if (!plan.visionBoardImages || plan.visionBoardImages.length === 0) {
    return null;
  }

  // Group images by year
  const imagesByYear = plan.visionBoardImages.reduce((acc, vb) => {
    if (!acc[vb.year]) {
      acc[vb.year] = [];
    }
    acc[vb.year].push(vb);
    return acc;
  }, {} as Record<number, VisionBoardImages[]>);

  const years = Object.keys(imagesByYear).map(Number).sort((a, b) => a - b);

  return (
    <>
      <div style={{
        marginTop: '32px',
        padding: '24px',
        background: 'rgba(52, 211, 153, 0.05)',
        borderRadius: '12px',
        border: '1px solid rgba(52, 211, 153, 0.2)'
      }}>
        <h3 style={{ marginBottom: '8px', fontSize: '20px', fontWeight: 600, color: 'var(--accent)' }}>
          📸 Vision Board Gallery
        </h3>
        <div className="small" style={{ marginBottom: '20px', color: 'var(--muted)' }}>
          {plan.visionBoardImages.length} vision board{plan.visionBoardImages.length !== 1 ? 's' : ''} from your timeline
        </div>

        {years.map(year => (
          <div key={year} style={{ marginBottom: '32px' }}>
            <h4 style={{ marginBottom: '12px', fontSize: '18px', fontWeight: 500, color: 'var(--accent)' }}>
              {year}
            </h4>

            {imagesByYear[year].map(vb => (
              <div key={`${vb.year}-${vb.dayType}`} style={{ marginBottom: '20px' }}>
                <div className="small" style={{ marginBottom: '8px', fontWeight: 500 }}>
                  {DAY_TYPE_LABELS[vb.dayType]}
                </div>

                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                  gap: '12px'
                }}>
                  {vb.images.map((img, idx) => (
                    <div
                      key={idx}
                      onClick={() => setSelectedImage({
                        imageUrl: img.imageUrl,
                        description: img.sceneDescription,
                        year: vb.year,
                        dayType: vb.dayType
                      })}
                      style={{
                        cursor: 'pointer',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        transition: 'transform 0.2s, box-shadow 0.2s'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.05)';
                        e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = 'none';
                      }}
                    >
                      <img
                        src={img.imageUrl}
                        alt={img.sceneDescription}
                        style={{
                          width: '100%',
                          height: '180px',
                          objectFit: 'cover',
                          display: 'block'
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div
          className="year-modal-overlay open"
          onClick={() => setSelectedImage(null)}
          style={{ zIndex: 10000 }}
        >
          <div
            className="year-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '900px', padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div>
                <h3 style={{ fontSize: '20px', fontWeight: 600, marginBottom: '4px' }}>
                  {selectedImage.year} - {DAY_TYPE_LABELS[selectedImage.dayType]}
                </h3>
              </div>
              <button className="btn" onClick={() => setSelectedImage(null)}>✕ Close</button>
            </div>

            <img
              src={selectedImage.imageUrl}
              alt={selectedImage.description}
              style={{
                width: '100%',
                maxHeight: '600px',
                objectFit: 'contain',
                borderRadius: '8px',
                marginBottom: '16px'
              }}
            />

            {selectedImage.description && (
              <div className="small" style={{ color: 'var(--muted)', textAlign: 'center' }}>
                {selectedImage.description}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
