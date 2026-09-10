import './History.css';

const MOCK_HISTORY = [
  {
    date: 'September 10',
    sessions: [
      { exercise: 'Pull-up', sets: 5, reps: 25 },
    ],
  },
  {
    date: 'September 9',
    sessions: [
      { exercise: 'Pull-up', sets: 5, reps: 25 },
      { exercise: 'Push-up', sets: 3, reps: 60 },
    ],
  },
  {
    date: 'September 8',
    sessions: [
      { exercise: 'Pull-up', sets: 4, reps: 20 },
    ],
  },
];

export default function History() {
  return (
    <div className="history">
      <h2 className="history-title">History</h2>

      {MOCK_HISTORY.map(day => (
        <div key={day.date} className="history-day">
          <div className="history-date">{day.date}</div>
          {day.sessions.map(s => (
            <div key={s.exercise} className="history-session">
              <div className="history-exercise">{s.exercise}</div>
              <div className="history-detail">{s.sets} sets · {s.reps} reps total</div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
