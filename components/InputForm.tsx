'use client';

import { useState } from 'react';
import { Plan, Person, CityPlan, FamilyPhoto } from '../lib/types';
import { id, thisYear } from '../lib/util';

type Props = {
  plan: Plan;
  onChange: (p: Plan) => void;
};

export default function InputForm({ plan, onChange }: Props) {
  const [local, setLocal] = useState<Plan>(plan);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const y = thisYear();

  const update = (partial: Partial<Plan>) => setLocal({ ...local, ...partial });

  const commit = () => onChange(local);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Create canvas for compression
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }

          // Resize to max 800x800 while maintaining aspect ratio
          const maxSize = 800;
          let width = img.width;
          let height = img.height;

          if (width > height && width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          } else if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }

          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);

          // Compress to JPEG with 0.7 quality
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.7);
          resolve(compressedDataUrl);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Limit number of photos
    if ((local.familyPhotos || []).length >= 3) {
      setPhotoError('Maximum 3 photos allowed. Please remove a photo before adding a new one.');
      event.target.value = ''; // Reset input
      return;
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError('File too large. Please upload an image under 10MB.');
      return;
    }

    setPhotoError(null);
    setIsAnalyzingPhoto(true);

    try {
      // Compress image before storing
      const compressedDataUrl = await compressImage(file);

      // Store compressed photo
      const photo: FamilyPhoto = {
        id: id('photo'),
        dataUrl: compressedDataUrl,
        uploadedAt: Date.now()
      };

      const updatedPhotos = [...(local.familyPhotos || []), photo];
      setLocal({ ...local, familyPhotos: updatedPhotos });

      // Analyze photo to get character descriptions (use compressed version)
      try {
        const response = await fetch('/api/analyze-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            photoDataUrl: compressedDataUrl,
            people: local.people.map(p => ({ id: p.id, name: p.name }))
          })
        });

        if (!response.ok) {
          throw new Error('Failed to analyze photo');
        }

        const { characterDescriptions } = await response.json();
        // Merge new descriptions with existing ones
        const updatedDescriptions = [...(local.characterDescriptions || [])];
        characterDescriptions?.forEach((newDesc: any) => {
          const existingIndex = updatedDescriptions.findIndex(d => d.personId === newDesc.personId);
          if (existingIndex >= 0) {
            updatedDescriptions[existingIndex] = newDesc;
          } else {
            updatedDescriptions.push(newDesc);
          }
        });
        setLocal(prev => ({ ...prev, characterDescriptions: updatedDescriptions, familyPhotos: updatedPhotos }));
      } catch (err: any) {
        setPhotoError('Photo uploaded but analysis failed: ' + err.message);
      } finally {
        setIsAnalyzingPhoto(false);
      }
    } catch (err: any) {
      setPhotoError(err.message);
      setIsAnalyzingPhoto(false);
    }
  };

  const removePhoto = (photoId: string) => {
    const updatedPhotos = (local.familyPhotos || []).filter(p => p.id !== photoId);
    setLocal({ ...local, familyPhotos: updatedPhotos });
    // If no photos left, clear character descriptions
    if (updatedPhotos.length === 0) {
      setLocal({ ...local, familyPhotos: [], characterDescriptions: undefined });
    }
  };

  const updatePerson = (p: Person) => {
    setLocal({
      ...local,
      people: local.people.map(pp => (pp.id === p.id ? p : pp))
    });
  };

  const addKid = () => {
    const name = `Child ${local.people.filter(p => p.role === 'child').length + 1}`;
    // Default to birth year 2 years in the future for planning future children
    const kid: Person = { id: id('kid'), name, birthYear: y + 2, role: 'child', schoolStartAge: 5 };
    setLocal({ ...local, people: [...local.people, kid] });
  };

  const removePerson = (pid: string) => {
    setLocal({ ...local, people: local.people.filter(p => p.id !== pid) });
  };

  const addCity = () => {
    const cp: CityPlan = { yearFrom: local.startYear, city: 'San Francisco' };
    setLocal({ ...local, cityPlan: [...local.cityPlan, cp] });
  };

  const removeCity = (idx: number) => {
    const arr = [...local.cityPlan]; arr.splice(idx, 1);
    setLocal({ ...local, cityPlan: arr });
  };

  return (
    <div className="card vstack">
      <div className="hstack" style={{justifyContent:'space-between'}}>
        <div className="logo">
          <img src="/favicon.svg" width={22} height={22} alt="logo" />
          <span>Futureline</span>
        </div>
        <button className="btn primary" onClick={commit}>Generate</button>
      </div>

      <div>
        <div className="sectionTitle">Basics</div>
        <div className="hstack" style={{gap:12}}>
          <div style={{flex:1}}>
            <label className="small">Start year</label>
            <input className="input" type="number" value={local.startYear} onChange={e => update({ startYear: parseInt(e.target.value, 10) })} />
          </div>
          <div style={{flex:1}}>
            <label className="small">Horizon (years)</label>
            <input className="input" type="number" min={5} max={80} value={local.horizon} onChange={e => update({ horizon: parseInt(e.target.value, 10) })} />
          </div>
        </div>
      </div>

      <div>
        <div className="sectionTitle">Family Photos ({(local.familyPhotos || []).length}/3)</div>
        <div className="small" style={{ marginBottom: '8px' }}>
          Upload family photos to improve character consistency in AI-generated images (max 3 photos)
        </div>

        {(local.familyPhotos && local.familyPhotos.length > 0) && (
          <div style={{ display: 'flex', gap: '12px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {local.familyPhotos.map(photo => (
              <div key={photo.id} style={{ position: 'relative', width: '120px', height: '120px' }}>
                <img
                  src={photo.dataUrl}
                  alt="Family photo"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                />
                <button
                  className="btn"
                  onClick={() => removePhoto(photo.id)}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    padding: '4px 8px',
                    fontSize: '12px',
                    background: 'rgba(0,0,0,0.7)'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {local.characterDescriptions && Array.isArray(local.characterDescriptions) && local.characterDescriptions.length > 0 && (
          <div style={{ marginBottom: '12px', padding: '16px', background: 'rgba(52,211,153,0.15)', borderRadius: '8px', border: '1px solid rgba(52,211,153,0.5)' }}>
            <div style={{ fontWeight: 600, marginBottom: '12px', color: 'var(--accent2)', fontSize: '14px' }}>
              ✓ Character Descriptions for AI Image Generation
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {local.characterDescriptions.map((char: any, idx: number) => (
                <div key={char.personId || idx} style={{ padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
                  <div style={{ fontWeight: 600, marginBottom: '6px', color: 'var(--accent2)', fontSize: '13px' }}>
                    {char.personName}
                  </div>
                  <div style={{ fontSize: '13px', lineHeight: '1.6', color: 'rgba(255,255,255,0.85)' }}>
                    {char.description}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {photoError && (
          <div className="small" style={{ color: 'var(--danger)', marginBottom: '8px' }}>
            {photoError}
          </div>
        )}

        <div>
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoUpload}
            disabled={isAnalyzingPhoto || (local.familyPhotos || []).length >= 3}
            style={{ display: 'none' }}
            id="photo-upload"
          />
          <label
            htmlFor="photo-upload"
            className="btn"
            style={{
              cursor: isAnalyzingPhoto ? 'wait' : ((local.familyPhotos || []).length >= 3 ? 'not-allowed' : 'pointer'),
              display: 'inline-block',
              opacity: (local.familyPhotos || []).length >= 3 ? 0.5 : 1
            }}
          >
            {isAnalyzingPhoto ? 'Analyzing Photo...' : (local.familyPhotos || []).length >= 3 ? '📷 Max Photos Reached' : '📷 Upload Family Photo'}
          </label>
        </div>
      </div>

      <div>
        <div className="sectionTitle">People</div>
        {local.people.map((p) => (
          <div key={p.id} className="card" style={{padding:10, marginBottom:6}}>
            <div className="hstack" style={{gap:8}}>
              <div style={{flex:2}}>
                <label className="small">Name</label>
                <input className="input" value={p.name} onChange={e => updatePerson({ ...p, name: e.target.value })} />
              </div>
              <div style={{flex:1}}>
                <label className="small">Role</label>
                <select className="select" value={p.role} onChange={e => updatePerson({ ...p, role: e.target.value as any })}>
                  <option value="self">Self</option>
                  <option value="partner">Partner</option>
                  <option value="child">Child</option>
                  <option value="relative">Relative</option>
                </select>
              </div>
              <div style={{flex:1}}>
                <label className="small">{p.birthYear <= y ? 'Current age' : 'Birth year'}</label>
                {p.birthYear <= y ? (
                  <input className="input" type="number"
                    value={y - p.birthYear}
                    onChange={e => updatePerson({ ...p, birthYear: y - parseInt(e.target.value || '0', 10) })} />
                ) : (
                  <input className="input" type="number"
                    value={p.birthYear}
                    onChange={e => updatePerson({ ...p, birthYear: parseInt(e.target.value || String(y), 10) })} />
                )}
              </div>
              <div style={{flex:1}}>
                <label className="small">School start age</label>
                <input className="input" type="number" value={p.schoolStartAge ?? 5}
                  onChange={e => updatePerson({ ...p, schoolStartAge: parseInt(e.target.value||'5', 10) })} />
              </div>
              <div>
                <button className="btn" onClick={() => removePerson(p.id)}>Remove</button>
              </div>
            </div>
          </div>
        ))}
        <div className="hstack">
          <button className="btn" onClick={addKid}>Add child</button>
        </div>
      </div>

      <div>
        <div className="sectionTitle">City plan</div>
        {local.cityPlan.map((c, idx) => (
          <div key={idx} className="hstack" style={{gap:8, marginBottom:6}}>
            <input className="input" style={{flex:1}} placeholder="From year" type="number" value={c.yearFrom}
              onChange={e => {
                const arr = [...local.cityPlan]; arr[idx] = { ...arr[idx], yearFrom: parseInt(e.target.value || '0',10) };
                setLocal({ ...local, cityPlan: arr });
              }} />
            <input className="input" style={{flex:1}} placeholder="To year" type="number" value={c.yearTo ?? ''}
              onChange={e => {
                const val = e.target.value;
                const arr = [...local.cityPlan]; arr[idx] = { ...arr[idx], yearTo: val ? parseInt(val,10) : undefined };
                setLocal({ ...local, cityPlan: arr });
              }} />
            <input className="input" style={{flex:2}} placeholder="City" value={c.city}
              onChange={e => {
                const arr = [...local.cityPlan]; arr[idx] = { ...arr[idx], city: e.target.value };
                setLocal({ ...local, cityPlan: arr });
              }} />
            <button className="btn" onClick={() => removeCity(idx)}>Delete</button>
          </div>
        ))}
        <button className="btn" onClick={addCity}>Add city</button>
      </div>

      <div className="small">Changes are local; click Generate to render the timeline.</div>
    </div>
  );
}
