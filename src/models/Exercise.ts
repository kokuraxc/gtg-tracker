export interface Exercise {
  id?: number;
  name: string;
  category: string;
  trackingType: 'reps' | 'duration' | 'distance';
  supportsWeight: boolean;
  supportsReps: boolean;
  supportsDuration: boolean;
  supportsDistance: boolean;
  createdAt: Date;
  updatedAt: Date;
  archived: boolean;
}
