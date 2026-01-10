import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ContestWebSocketService } from '../services/websocket';
import { WebSocketEvent, LeaderboardUpdateEvent, QuestionBroadcastEvent } from '../types';

const Monitor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [currentQuestion, setCurrentQuestion] = useState<QuestionBroadcastEvent['data'] | null>(null);
  const [timer, setTimer] = useState<{ remaining: number; total: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUpdateEvent['data']['topN']>([]);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [submissionCount, setSubmissionCount] = useState(0);

  useEffect(() => {
    if (!id) return;

    const service = new ContestWebSocketService(
      id,
      handleWebSocketMessage,
      (error) => console.error('WebSocket error:', error),
      (event) => console.log('WebSocket closed:', event.code)
    );

    service.connect();

    return () => {
      service.disconnect();
    };
  }, [id]);

  const handleWebSocketMessage = (event: WebSocketEvent) => {
    switch (event.event) {
      case 'question_broadcast':
        setCurrentQuestion(event.data);
        setTimer({ remaining: event.data.timeLimit, total: event.data.timeLimit });
        break;
      case 'timer_update':
        setTimer({ remaining: event.data.timeRemaining, total: event.data.totalTime });
        break;
      case 'leaderboard_update':
        setLeaderboard(event.data.topN);
        setTotalParticipants(event.data.totalParticipants);
        // Assuming submission count is derived from leaderboard or separate event
        setSubmissionCount(event.data.topN.reduce((sum, entry) => sum + entry.questionsAnswered, 0));
        break;
      case 'contest_end':
        setCurrentQuestion(null);
        setTimer(null);
        break;
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      <h2>Contest Monitor - {id}</h2>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3>Current Question</h3>
          {currentQuestion ? (
            <div style={{ padding: '10px', border: '1px solid #ddd' }}>
              <h4>{currentQuestion.title}</h4>
              <p>{currentQuestion.description}</p>
              <p>Points: {currentQuestion.points}</p>
              {timer && (
                <p>Time Remaining: {Math.ceil(timer.remaining)} / {timer.total} seconds</p>
              )}
              {currentQuestion.mcqOptions && (
                <ul>
                  {currentQuestion.mcqOptions.map((option) => (
                    <li key={option.id}>{option.text}</li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p>No active question</p>
          )}
        </div>

        <div>
          <h3>Statistics</h3>
          <p>Total Participants: {totalParticipants}</p>
          <p>Total Submissions: {submissionCount}</p>
        </div>
      </div>

      <div style={{ marginTop: '20px' }}>
        <h3>Live Leaderboard</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Rank</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>User</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Score</th>
              <th style={{ border: '1px solid #ddd', padding: '8px' }}>Questions Answered</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((entry) => (
              <tr key={entry.userId}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.rank}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.userName}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.score}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{entry.questionsAnswered}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Monitor;