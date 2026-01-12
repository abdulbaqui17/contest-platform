import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Trophy, Clock, Check, X } from 'lucide-react';

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
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="h-12 w-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <X className="h-6 w-6 text-red-400" />
            </div>
            <h3 className="text-xl font-semibold text-zinc-100 mb-2">{error}</h3>
            <Button onClick={() => navigate('/contests')} variant="primary" className="mt-4">
              Back to Contests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (contestEnded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <Trophy className="h-8 w-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-4">Contest Ended!</h2>
            {submissionResult && (
              <div className="space-y-2 mb-6">
                <p className="text-lg text-zinc-300">
                  Final Score: <span className="text-purple-400 font-bold">{submissionResult.currentScore}</span>
                </p>
                <p className="text-lg text-zinc-300">
                  Final Rank: <span className="text-yellow-400 font-bold">#{submissionResult.currentRank}</span>
                </p>
              </div>
            )}
            <Button onClick={() => navigate('/contests')} variant="primary" size="lg" className="w-full">
              Back to Contests
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400">Waiting for contest to start...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[250px_1fr] h-screen bg-zinc-950">
      {/* Left Sidebar - Question List */}
      <div className="bg-zinc-900 border-r border-zinc-800 p-6 overflow-y-auto">
        <h3 className="text-zinc-100 mb-6 text-lg font-semibold">Questions</h3>
        <div className="flex flex-col gap-2">
          {Array.from({ length: currentQuestion.totalQuestions }).map((_, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg text-sm font-medium transition-colors ${
                idx + 1 === currentQuestion.questionNumber
                  ? 'bg-purple-600 text-white border-2 border-purple-400'
                  : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
              }`}
            >
              Question {idx + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex flex-col h-screen overflow-y-auto">
        {/* Top Bar with Timer and Rank */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-8 py-4 flex justify-between items-center sticky top-0 z-10">
          <div className="flex gap-8 items-center">
            <div>
              <span className="text-zinc-500 text-sm">Score</span>
              <div className="text-2xl font-bold text-purple-400">{currentScore}</div>
            </div>
            <div>
              <span className="text-zinc-500 text-sm">Rank</span>
              <div className="text-2xl font-bold text-zinc-100">#{currentRank || '-'}</div>
            </div>
          </div>
          <div className={`flex items-center gap-3 px-4 py-2 rounded-lg border-2 ${
            timeRemaining < 10
              ? 'bg-red-500/10 border-red-500/50'
              : 'bg-zinc-800 border-zinc-700'
          }`}>
            <Clock className={`h-5 w-5 ${timeRemaining < 10 ? 'text-red-400' : 'text-zinc-400'}`} />
            <span className={`text-3xl font-bold min-w-[60px] text-center ${
              timeRemaining < 10 ? 'text-red-400' : 'text-purple-400'
            }`}>
              {Math.ceil(timeRemaining)}s
            </span>
          </div>
        </div>

        {/* Question Content */}
        <div className="p-8 max-w-4xl mx-auto w-full">
          {/* Question Header */}
          <div className="mb-8 pb-6 border-b-2 border-zinc-800">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-zinc-100 text-xl font-semibold">
                Question {currentQuestion.questionNumber} of {currentQuestion.totalQuestions}
              </h2>
              <Badge variant="active">{currentQuestion.points} points</Badge>
            </div>
            <h3 className="text-zinc-100 text-2xl font-bold mb-4">{currentQuestion.title}</h3>
            <p className="text-zinc-400 leading-relaxed">{currentQuestion.description}</p>
          </div>

          {/* Submission Result */}
          {submissionResult && (
            <div className={`mb-8 p-4 rounded-lg border ${
              submissionResult.isCorrect
                ? 'bg-green-500/10 border-green-500/50'
                : 'bg-red-500/10 border-red-500/50'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                {submissionResult.isCorrect ? (
                  <Check className="h-6 w-6 text-green-400" />
                ) : (
                  <X className="h-6 w-6 text-red-400" />
                )}
                <h3 className={`text-lg font-semibold ${
                  submissionResult.isCorrect ? 'text-green-400' : 'text-red-400'
                }`}>
                  {submissionResult.isCorrect ? 'Correct Answer!' : 'Incorrect Answer'}
                </h3>
              </div>
              <p className="text-zinc-300 text-sm">
                Points earned: {submissionResult.pointsEarned} | 
                Total score: {submissionResult.currentScore} | 
                Rank: #{submissionResult.currentRank}
              </p>
            </div>
          )}

          {/* MCQ Options */}
          <div className="grid gap-3 mb-8">
            {currentQuestion.mcqOptions?.map((option, index) => {
              const isSelected = selectedOption === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => !submitting && !submissionResult && setSelectedOption(option.id)}
                  disabled={submitting || !!submissionResult}
                  className={`p-4 text-left rounded-xl border-2 transition-all flex items-center gap-4 ${
                    isSelected
                      ? 'bg-zinc-800 border-purple-500'
                      : 'bg-zinc-900 border-zinc-700 hover:border-zinc-600'
                  } ${
                    (submitting || submissionResult) ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                >
                  <span className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold text-sm ${
                    isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span className="text-zinc-100">{option.text}</span>
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          <Button
            onClick={handleSubmit}
            disabled={!selectedOption || submitting || !!submissionResult}
            variant="primary"
            size="lg"
            className="w-full"
          >
            {submitting
              ? 'Submitting...'
              : submissionResult
              ? 'Waiting for next question...'
              : 'Submit Answer'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PlayContest;
