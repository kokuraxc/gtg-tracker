export interface Exercise {
  id?: number;
  name: string;
  category: string;
  trackingType: 'reps' | 'duration' | 'distance';
  supportsWeight: boolean;
  supportsReps: boolean;
  supportsDuration: boolean;
  supportsDistance: boolean;
  defaultReps?: number;
  defaultDuration?: number;
  durationUnit?: 'min' | 'sec';
  defaultDistance?: number;
  gtgEnabled: boolean;
  gtgMinIntervalMinutes: number;
  gtgMaxSetsPerDay: number;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}
