export interface WorkoutSet {
  id?: number;
  sessionId: number;
  setNumber: number;
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  timestamp: Date;
  notes?: string;
}
