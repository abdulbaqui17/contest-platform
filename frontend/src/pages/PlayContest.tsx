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
  const [currentRank, setCurrentRank] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(0);
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

    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const wsUrl = `${WS_URL}/ws/contest?token=${token}`;
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
        setCurrentScore(message.data.currentScore);
        setCurrentRank(message.data.currentRank);
        setSubmitting(false);
        break;

      case 'leaderboard_update':
        // Update rank if provided
        if (message.data.userRank) {
          setCurrentRank(message.data.userRank);
        }
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
      <div className="container" style={{ paddingTop: '4rem' }}>
        <div className="error-message">
          <h3>{error}</h3>
        </div>
        <div className="text-center mt-lg">
          <button onClick={() => navigate('/contests')} className="btn btn-primary">
            Back to Contests
          </button>
        </div>
      </div>
    );
  }

  if (contestEnded) {
    return (
      <div className="container" style={{ paddingTop: '4rem' }}>
        <div className="card text-center">
          <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Contest Ended!</h2>
          {submissionResult && (
            <div style={{ fontSize: '1.125rem', marginBottom: 'var(--spacing-xl)' }}>
              <p>Your Final Score: <strong>{submissionResult.currentScore}</strong></p>
              <p>Your Rank: <strong>#{submissionResult.currentRank}</strong></p>
            </div>
          )}
          <button onClick={() => navigate('/contests')} className="btn btn-primary btn-lg">
            Back to Contests
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="loading">
        <div>
          <div className="spinner" style={{ margin: '0 auto var(--spacing-md)' }}></div>
          <p>Waiting for contest to start...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '250px 1fr',
      height: '100vh',
      backgroundColor: 'var(--bg-primary)'
    }}>
      {/* Left Sidebar - Question List */}
      <div style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        padding: 'var(--spacing-lg)',
        overflowY: 'auto'
      }}>
        <h3 style={{
          color: 'var(--text-primary)',
          marginBottom: 'var(--spacing-lg)',
          fontSize: '1.125rem'
        }}>
          Questions
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-sm)' }}>
          {Array.from({ length: currentQuestion.totalQuestions }).map((_, idx) => (
            <div
              key={idx}
              style={{
                padding: 'var(--spacing-md)',
                backgroundColor: idx + 1 === currentQuestion.questionNumber
                  ? 'var(--accent-primary)'
                  : 'var(--bg-tertiary)',
                color: idx + 1 === currentQuestion.questionNumber
                  ? 'white'
                  : 'var(--text-secondary)',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: idx + 1 === currentQuestion.questionNumber ? 600 : 400,
                border: idx + 1 === currentQuestion.questionNumber
                  ? '2px solid var(--accent-light)'
                  : '1px solid var(--border-color)'
              }}
            >
              Question {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflowY: 'auto'
      }}>
        {/* Top Bar with Timer and Rank */}
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-color)',
          padding: 'var(--spacing-lg) var(--spacing-xl)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div style={{ display: 'flex', gap: 'var(--spacing-xl)', alignItems: 'center' }}>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Score</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>
                {currentScore}
              </div>
            </div>
            <div>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Rank</span>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                #{currentRank || '-'}
              </div>
            </div>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--spacing-md)',
            backgroundColor: timeRemaining < 10 ? 'var(--error-bg)' : 'var(--bg-tertiary)',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            borderRadius: 'var(--radius-lg)',
            border: `2px solid ${timeRemaining < 10 ? 'var(--error-border)' : 'var(--border-color)' }`
          }}>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Time</span>
            <div style={{
              fontSize: '2rem',
              fontWeight: 'bold',
              color: timeRemaining < 10 ? 'var(--error-text)' : 'var(--accent-primary)',
              minWidth: '60px',
              textAlign: 'center'
            }}>
              {Math.ceil(timeRemaining)}s
            </div>
          </div>
        </div>

        {/* Question Content */}
        <div style={{ padding: 'var(--spacing-xl)', maxWidth: '900px', margin: '0 auto', width: '100%' }}>
          {/* Question Header */}
          <div style={{
            marginBottom: 'var(--spacing-xl)',
            paddingBottom: 'var(--spacing-lg)',
            borderBottom: '2px solid var(--border-color)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
              <h2 style={{ color: 'var(--text-primary)', margin: 0 }}>
                Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
              </h2>
              <span className="badge badge-active">
                {currentQuestion.points} points
              </span>
            </div>
            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', marginBottom: 'var(--spacing-md)' }}>
              {currentQuestion.title}
            </h3>
            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              {currentQuestion.description}
            </p>
          </div>

          {/* Submission Result */}
          {submissionResult && (
            <div className={submissionResult.isCorrect ? 'success-message' : 'error-message'}
              style={{ marginBottom: 'var(--spacing-xl)' }}>
              <h3 style={{ marginBottom: 'var(--spacing-sm)' }}>
                {submissionResult.isCorrect ? '✓ Correct Answer!' : '✗ Incorrect Answer'}
              </h3>
              <p style={{ margin: 0 }}>
                Points earned: {submissionResult.pointsEarned} | 
                Total score: {submissionResult.currentScore} | 
                Rank: #{submissionResult.currentRank}
              </p>
            </div>
          )}

          {/* MCQ Options */}
          <div style={{ display: 'grid', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-xl)' }}>
            {currentQuestion.mcqOptions?.map((option, index) => {
              const isSelected = selectedOption === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => !submitting && !submissionResult && setSelectedOption(option.id)}
                  disabled={submitting || !!submissionResult}
                  style={{
                    padding: 'var(--spacing-lg)',
                    textAlign: 'left',
                    backgroundColor: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-card)',
                    border: `2px solid ${isSelected ? 'var(--accent-primary)' : 'var(--border-color)'}`,
                    borderRadius: 'var(--radius-lg)',
                    color: 'var(--text-primary)',
                    cursor: submitting || submissionResult ? 'not-allowed' : 'pointer',
                    opacity: submitting || submissionResult ? 0.6 : 1,
                    fontSize: '1rem',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--spacing-md)'
                  }}
                >
                  <span style={{
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '50%',
                    backgroundColor: isSelected ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                    color: isSelected ? 'white' : 'var(--text-secondary)',
                    fontWeight: 600,
                    flexShrink: 0
                  }}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          <button
            onClick={handleSubmit}
            disabled={!selectedOption || submitting || !!submissionResult}
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
          >
            {submitting
              ? 'Submitting...'
              : submissionResult
              ? 'Waiting for next question...'
              : 'Submit Answer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlayContest;
