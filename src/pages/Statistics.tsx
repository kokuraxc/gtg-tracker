import './Statistics.css';

const MOCK_STATS = [
  { label: 'Today', value: '25 reps' },
  { label: 'This week', value: '132 reps' },
  { label: 'Best set', value: '8 reps' },
  { label: 'Avg reps/set', value: '5.2' },
  { label: 'Sets this week', value: '27' },
  { label: 'Training days', value: '5' },
];

export default function Statistics() {
  return (
    <div className="statistics">
      <h2 className="statistics-title">Statistics</h2>

      <div className="stats-exercise-name">Pull-up</div>

      <div className="stats-grid">
        {MOCK_STATS.map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
