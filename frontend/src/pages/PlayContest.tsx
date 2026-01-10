import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

interface MCQOption {
  id: string;
  text: string;
}

interface Question {
  questionId: string;
  title: string;
  description: string;
  mcqOptions?: MCQOption[];
  timeLimit: number;
  points: number;
  questionNumber: number;
  totalQuestions: number;
}

interface SubmissionResult {
  isCorrect: boolean;
  pointsEarned: number;
  currentScore: number;
  currentRank: number;
}

const PlayContest: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [contestEnded, setContestEnded] = useState(false);
  const [error, setError] = useState('');
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    connectWebSocket();
    return () => {
      if (ws) {
        ws.close(1000);
      }
    };
  }, [id]);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found');
      return;
    }

    const wsUrl = `ws://localhost:3000/ws/contest?token=${token}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('WebSocket connected');
      reconnectAttempts.current = 0;
      
      // Send join_contest or resync
      if (currentQuestion) {
        websocket.send(JSON.stringify({
          event: 'resync',
          data: { contestId: id }
        }));
      } else {
        websocket.send(JSON.stringify({
          event: 'join_contest',
          data: { contestId: id }
        }));
      }
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    websocket.onerror = (err) => {
      console.error('WebSocket error:', err);
      setError('Connection error');
    };

    websocket.onclose = (event) => {
      console.log('WebSocket closed:', event.code);
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts) {
        reconnectAttempts.current++;
        setTimeout(() => connectWebSocket(), 2000 * reconnectAttempts.current);
      }
    };

    setWs(websocket);
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.event) {
      case 'question_broadcast':
        setCurrentQuestion({
          questionId: message.data.questionId,
          title: message.data.title,
          description: message.data.description,
          mcqOptions: message.data.mcqOptions,
          timeLimit: message.data.timeLimit,
          points: message.data.points,
          questionNumber: message.data.questionNumber,
          totalQuestions: message.data.totalQuestions
        });
        setTimeRemaining(message.data.timeLimit);
        setSelectedOption(null);
        setSubmissionResult(null);
        setSubmitting(false);
        break;

      case 'timer_update':
        setTimeRemaining(message.data.timeRemaining);
        break;

      case 'submission_result':
        setSubmissionResult({
          isCorrect: message.data.isCorrect,
          pointsEarned: message.data.pointsEarned,
          currentScore: message.data.currentScore,
          currentRank: message.data.currentRank
        });
        setSubmitting(false);
        break;

      case 'contest_end':
        setContestEnded(true);
        setCurrentQuestion(null);
        break;

      case 'error':
        setError(message.data.message);
        break;
    }
  };

  const handleSubmit = () => {
    if (!ws || !currentQuestion || !selectedOption || submitting) return;

    setSubmitting(true);
    ws.send(JSON.stringify({
      event: 'submit_answer',
      data: {
        questionId: currentQuestion.questionId,
        selectedOptionId: selectedOption,
        submittedAt: new Date().toISOString()
      }
    }));
  };

  if (error) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3 style={{ color: 'red' }}>{error}</h3>
        <button onClick={() => navigate('/contests')} style={{ marginTop: '20px', padding: '10px 20px' }}>
          Back to Contests
        </button>
      </div>
    );
  }

  if (contestEnded) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h2>Contest Ended!</h2>
        {submissionResult && (
          <div style={{ marginTop: '20px', fontSize: '18px' }}>
            <p>Your Final Score: {submissionResult.currentScore}</p>
            <p>Your Rank: {submissionResult.currentRank}</p>
          </div>
        )}
        <button 
          onClick={() => navigate('/contests')} 
          style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#667eea', color: 'white', border: 'none', borderRadius: '4px' }}
        >
          Back to Contests
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <h3>Waiting for contest to start...</h3>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}</h3>
        <div style={{ 
          fontSize: '24px', 
          fontWeight: 'bold',
          color: timeRemaining < 10 ? 'red' : '#667eea'
        }}>
          {Math.ceil(timeRemaining)}s
        </div>
      </div>

      <div style={{ 
        padding: '20px', 
        border: '2px solid #667eea', 
        borderRadius: '8px',
        backgroundColor: '#f7fafc',
        marginBottom: '20px'
      }}>
        <h2>{currentQuestion.title}</h2>
        <p style={{ marginTop: '10px', color: '#666' }}>{currentQuestion.description}</p>
        <p style={{ marginTop: '10px', fontSize: '14px', color: '#667eea' }}>
          Points: {currentQuestion.points}
        </p>
      </div>

      {submissionResult && (
        <div style={{ 
          padding: '15px', 
          marginBottom: '20px',
          borderRadius: '8px',
          backgroundColor: submissionResult.isCorrect ? '#c6f6d5' : '#fed7d7',
          border: `2px solid ${submissionResult.isCorrect ? '#48bb78' : '#f56565'}`
        }}>
          <h3 style={{ margin: 0 }}>
            {submissionResult.isCorrect ? '✓ Correct!' : '✗ Incorrect'}
          </h3>
          <p style={{ margin: '8px 0 0 0' }}>
            Points earned: {submissionResult.pointsEarned} | 
            Total score: {submissionResult.currentScore} | 
            Rank: {submissionResult.currentRank}
          </p>
        </div>
      )}

      <div style={{ display: 'grid', gap: '12px' }}>
        {currentQuestion.mcqOptions?.map((option) => (
          <button
            key={option.id}
            onClick={() => !submitting && !submissionResult && setSelectedOption(option.id)}
            disabled={submitting || !!submissionResult}
            style={{
              padding: '16px',
              textAlign: 'left',
              border: `2px solid ${selectedOption === option.id ? '#667eea' : '#ddd'}`,
              borderRadius: '8px',
              backgroundColor: selectedOption === option.id ? '#ebf4ff' : 'white',
              cursor: submitting || submissionResult ? 'not-allowed' : 'pointer',
              opacity: submitting || submissionResult ? 0.6 : 1
            }}
          >
            {option.text}
          </button>
        ))}
      </div>

      <button
        onClick={handleSubmit}
        disabled={!selectedOption || submitting || !!submissionResult}
        style={{
          width: '100%',
          marginTop: '20px',
          padding: '16px',
          fontSize: '18px',
          backgroundColor: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: (!selectedOption || submitting || submissionResult) ? 'not-allowed' : 'pointer',
          opacity: (!selectedOption || submitting || submissionResult) ? 0.6 : 1
        }}
      >
        {submitting ? 'Submitting...' : submissionResult ? 'Waiting for next question...' : 'Submit Answer'}
      </button>
    </div>
  );
};

export default PlayContest;
