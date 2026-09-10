export interface WorkoutSession {
  id?: number;
  exerciseId: number;
  startedAt: Date;
  completedAt?: Date;
  protocol: string;
  notes?: string;
}
