
export type Year = number;
export type Role = 'self' | 'partner' | 'child' | 'relative';

export type Person = {
  id: string;
  name: string;
  birthYear: Year; // compute from currentYear - age
  role: Role;
  schoolStartAge?: number; // default 5
};

export type CityPlan = { yearFrom: Year; yearTo?: Year; city: string };

export type OneOff = { id: string; year: Year; label: string; amount: number }; // negative for cost

export type Experience =
  | { kind: 'recurring'; label: string; everyNYears: number; startYear: Year }
  | { kind: 'fixed'; label: string; year: Year };

export type FocusMix = { decadeStart: Year; work: number; family: number; health: number; friends: number };

export type FinancePlan = {
  startCumulative?: number;
  annualSavings: number;
  growthPct?: number;
  oneOffs: OneOff[];
};

export type FamilyPhoto = {
  id: string;
  dataUrl: string; // base64 image
  uploadedAt: number; // timestamp
};

export type DayType = 'christmas' | 'thanksgiving' | 'summer' | 'spring' | 'birthday';

export type DayJournals = Partial<Record<DayType, string>>;

export type CharacterDescription = {
  personId: string;
  personName: string;
  description: string;
};

export type TimelineImage = {
  year: Year;
  imageUrl: string;
  generatedAt: number;
};

export type VisionImage = {
  imageUrl: string;
  sceneDescription: string;
  index: number;
};

export type VisionBoardImages = {
  year: Year;
  dayType: DayType;
  images: VisionImage[];
  generatedAt: number;
};

export type Plan = {
  startYear: Year; // usually current year
  horizon: number; // years
  people: Person[];
  cityPlan: CityPlan[];
  finance: FinancePlan;
  experiences: Experience[];
  focus: FocusMix[];
  journal: Record<Year, DayJournals>; // Multiple day types per year
  familyPhotos?: FamilyPhoto[]; // uploaded family photos
  characterDescriptions?: CharacterDescription[]; // AI-extracted character descriptions mapped to people
  timelineImages?: TimelineImage[]; // AI-generated image for each year
  visionBoardImages?: VisionBoardImages[]; // Vision board images per year/day
};

export type YearSummary = {
  year: Year;
  ages: Record<string, number>; // personId -> age
  city?: string;
  savingsCumulative: number;
  milestones: string[];
  moments: string[];
};
