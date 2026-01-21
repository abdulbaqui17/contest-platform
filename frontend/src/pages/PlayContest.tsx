import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Trophy, Clock, Check, X } from 'lucide-react';
import UserProfileDropdown from '../components/UserProfileDropdown';

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

interface FinalResult {
  rank: number;
  score: number;
  questionsAnswered: number;
  correctAnswers?: number;
}

interface ContestInfo {
  title: string;
  startTime: string;
  totalQuestions: number;
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  score: number;
  questionsAnswered: number;
}

const PlayContest: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [contestEnded, setContestEnded] = useState(false);
  const [alreadyCompleted, setAlreadyCompleted] = useState(false);
  const [finalResult, setFinalResult] = useState<FinalResult | null>(null);
  const [currentRank, setCurrentRank] = useState<number>(0);
  const [currentScore, setCurrentScore] = useState<number>(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  // Question transition state
  const [transitionMessage, setTransitionMessage] = useState<string>('');
  // UPCOMING state handling
  const [contestInfo, setContestInfo] = useState<ContestInfo | null>(null);
  const [countdownToStart, setCountdownToStart] = useState<number>(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // FIX #1: Only connect WebSocket after auth token is available
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      console.log('⚠️ No auth token found, cannot connect WebSocket');
      setError('No authentication token found. Please sign in.');
      setLoading(false);
      return;
    }

    console.log('✅ Auth token found, connecting WebSocket...');
    connectWebSocket();

    return () => {
      if (ws) {
        ws.close(1000);
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (countdownRef.current) {
        clearInterval(countdownRef.current);
      }
    };
  }, [id]);

  // Countdown timer for UPCOMING contests
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }

    if (countdownToStart > 0) {
      countdownRef.current = setInterval(() => {
        setCountdownToStart(prev => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            // Contest should be starting now - resync to get the first question
            if (ws && ws.readyState === WebSocket.OPEN) {
              console.log('⏰ Countdown finished, requesting resync...');
              ws.send(JSON.stringify({
                event: 'resync',
                data: { contestId: id }
              }));
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [countdownToStart, ws, id]);

  // Local timer countdown (backup for when server timer updates are delayed)
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    if (timeRemaining > 0 && currentQuestion && !contestEnded) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [currentQuestion?.questionId, contestEnded]);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) {
      setError('No authentication token found. Please sign in.');
      setLoading(false);
      return;
    }

    const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3001';
    const wsUrl = `${WS_URL}/ws/contest?token=${token}`;
    
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('✅ WebSocket connected');
      setConnected(true);
      reconnectAttempts.current = 0;
      
      // Always send join_contest first - server will handle state
      websocket.send(JSON.stringify({
        event: 'join_contest',
        data: { contestId: id }
      }));
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log('📩 WebSocket message:', message.event, message.data);
        handleWebSocketMessage(message);
      } catch (err) {
        console.error('Failed to parse message:', err);
      }
    };

    websocket.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    websocket.onclose = (event) => {
      console.log('🔌 WebSocket closed:', event.code, event.reason);
      setConnected(false);
      
      // Don't reconnect if closed normally or user left
      if (event.code !== 1000 && reconnectAttempts.current < maxReconnectAttempts && !contestEnded) {
        reconnectAttempts.current++;
        console.log(`🔄 Reconnecting... attempt ${reconnectAttempts.current}`);
        setTimeout(() => connectWebSocket(), 2000 * reconnectAttempts.current);
      }
    };

    setWs(websocket);
  };

  const handleWebSocketMessage = (message: any) => {
    setLoading(false); // We got a response, no longer loading

    switch (message.event) {
      case 'question_broadcast':
        console.log('📝 Received question:', message.data.questionNumber, 'of', message.data.totalQuestions);
        console.log('🔍 MCQ Options received:', message.data.mcqOptions);
        
        // CRITICAL: Validate mcqOptions exist
        if (!message.data.mcqOptions || message.data.mcqOptions.length === 0) {
          console.error('❌ ERROR: No MCQ options in question_broadcast!', message.data);
          setError('Question data is incomplete. Please refresh.');
          return;
        }
        
        // CRITICAL: Clear countdown when we get a question - contest has started!
        setCountdownToStart(0);
        if (countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        // Clear transition message - new question is here!
        setTransitionMessage('');
        
        // FULL STATE REPLACEMENT - treat this as the ONLY source of truth
        const newQuestion: Question = {
          questionId: message.data.questionId,
          title: message.data.title,
          description: message.data.description,
          mcqOptions: message.data.mcqOptions, // Always from server
          timeLimit: message.data.timeLimit,
          points: message.data.points,
          questionNumber: message.data.questionNumber,
          totalQuestions: message.data.totalQuestions
        };
        
        console.log('✅ Setting question state:', {
          questionId: newQuestion.questionId,
          optionsCount: newQuestion.mcqOptions?.length
        });
        
        setCurrentQuestion(newQuestion);
        setTimeRemaining(message.data.timeLimit);
        // CRITICAL: Reset UI state for new question
        setSelectedOption(null);
        setSubmissionResult(null);
        setSubmitting(false);
        setError(''); // Clear any previous errors
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
        
        // CRITICAL FIX: After submission, request next question via resync
        // This ensures each user progresses at their own pace
        if (message.data.nextQuestionIndex !== undefined) {
          console.log('✅ Submission complete, next question index:', message.data.nextQuestionIndex);
          if (message.data.completed) {
            console.log('🏁 All questions completed!');
            // Don't resync - wait for contest_end or show completion
          } else {
            // Request next question after a brief delay to show result feedback
            console.log('📤 Requesting next question after submission...');
            setTimeout(() => {
              if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                  event: 'resync',
                  data: { contestId: id }
                }));
              }
            }, 1500); // 1.5 second delay to show result before moving to next question
          }
        }
        break;

      case 'leaderboard_update':
        console.log('📊 Leaderboard update received:', message.data);
        if (message.data.userEntry) {
          setCurrentRank(message.data.userEntry.rank);
          setCurrentScore(message.data.userEntry.score);
        }
        if (message.data.topN) {
          setLeaderboard(message.data.topN);
        }
        break;

      case 'question_change':
        // Show transition message - next question is coming!
        console.log('⏭️ Question changing:', message.data.message);
        setTransitionMessage(message.data.message || 'Loading next question...');
        break;

      case 'contest_end':
        console.log('🏁 Contest ended:', message.data);
        setContestEnded(true);
        setCurrentQuestion(null);
        if (message.data.alreadyCompleted) {
          setAlreadyCompleted(true);
        }
        if (message.data.userFinalRank) {
          setFinalResult(message.data.userFinalRank);
        }
        break;

      case 'contest_start':
        // Contest is UPCOMING - show countdown
        console.log('⏰ Contest starting at:', message.data.startTime);
        if (message.data.countdownToStart !== undefined && message.data.countdownToStart > 0) {
          setCountdownToStart(message.data.countdownToStart);
          setContestInfo({
            title: message.data.contestName || message.data.title || 'Contest',
            startTime: message.data.startTime,
            totalQuestions: message.data.totalQuestions || 0
          });
        }
        break;

      case 'contest_status':
        console.log('📊 Contest status:', message.data.status);
        // Don't show error for UPCOMING - we handle it with countdown
        if (message.data.status === 'UPCOMING' && message.data.countdownToStart) {
          setCountdownToStart(message.data.countdownToStart);
          setContestInfo({
            title: message.data.contestName || message.data.title || 'Contest',
            startTime: message.data.startAt,
            totalQuestions: message.data.totalQuestions || 0
          });
        } else if (message.data.status === 'COMPLETED') {
          setContestEnded(true);
        }
        break;

      case 'error':
        console.error('❌ Server error:', message.data);
        // Don't show error for UPCOMING contests if we're showing countdown
        if (countdownToStart > 0) return;
        setError(message.data.message);
        break;

      case 'pong':
        // Heartbeat response
        break;
    }
  };

  const handleSubmit = () => {
    if (!ws || !currentQuestion || !selectedOption || submitting || submissionResult) return;

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

  const handleResync = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        event: 'resync',
        data: { contestId: id }
      }));
    }
  };

  // Error state
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

  // Contest ended or already completed state
  if (contestEnded || alreadyCompleted) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <Trophy className="h-8 w-8 text-purple-400" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              {alreadyCompleted ? 'Contest Already Completed' : 'Contest Ended!'}
            </h2>
            {alreadyCompleted && (
              <p className="text-zinc-400 mb-4">
                You have already submitted all answers for this contest.
              </p>
            )}
            {finalResult && (
              <div className="space-y-3 mb-6 p-4 bg-zinc-900 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Final Score</span>
                  <span className="text-2xl font-bold text-purple-400">{finalResult.score}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Final Rank</span>
                  <span className="text-2xl font-bold text-yellow-400">#{finalResult.rank || '-'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-400">Questions Answered</span>
                  <span className="text-lg text-zinc-100">{finalResult.questionsAnswered}</span>
                </div>
                {finalResult.correctAnswers !== undefined && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-400">Correct Answers</span>
                    <span className="text-lg text-green-400">{finalResult.correctAnswers}</span>
                  </div>
                )}
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

  // UPCOMING state - show countdown
  if (countdownToStart > 0) {
    const minutes = Math.floor(countdownToStart / 60);
    const seconds = countdownToStart % 60;
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-purple-500/20 flex items-center justify-center mx-auto mb-6">
              <Clock className="h-8 w-8 text-purple-400 animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-100 mb-2">
              {contestInfo?.title || 'Contest'} Starting Soon
            </h2>
            <p className="text-zinc-400 mb-6">Get ready! The contest will begin in:</p>
            <div className="text-5xl font-mono font-bold text-purple-400 mb-6">
              {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
            </div>
            {contestInfo?.startTime && (
              <p className="text-sm text-zinc-500">
                Start time: {new Date(contestInfo.startTime).toLocaleTimeString()}
              </p>
            )}
            <div className="mt-6 p-4 bg-zinc-900/50 rounded-lg">
              <p className="text-sm text-zinc-400">
                💡 Tip: Stay on this page. Questions will appear automatically when the contest starts.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loading state - waiting for contest data
  if (loading || !currentQuestion) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400">
            {connected ? 'Loading contest...' : 'Connecting to server...'}
          </p>
          {connected && !currentQuestion && (
            <Button onClick={handleResync} variant="secondary" size="sm" className="mt-4">
              Refresh State
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-[250px_1fr] h-screen bg-zinc-950">
      {/* Left Sidebar - Question List & Leaderboard */}
      <div className="bg-zinc-900 border-r border-zinc-800 p-6 overflow-y-auto">
        {/* Questions Section */}
        <h3 className="text-zinc-100 mb-4 text-lg font-semibold">Questions</h3>
        <p className="text-zinc-500 text-xs mb-4">Questions unlock sequentially</p>
        <div className="flex flex-col gap-2 pointer-events-none select-none">
          {Array.from({ length: currentQuestion.totalQuestions }).map((_, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg text-sm font-medium transition-colors cursor-default ${
                idx + 1 === currentQuestion.questionNumber
                  ? 'bg-purple-600 text-white border-2 border-purple-400'
                  : idx + 1 < currentQuestion.questionNumber
                    ? 'bg-zinc-800/50 text-zinc-500 border border-zinc-700/50'
                    : 'bg-zinc-800 text-zinc-400 border border-zinc-700 opacity-50'
              }`}
            >
              Question {idx + 1}
              {idx + 1 < currentQuestion.questionNumber && (
                <span className="ml-2 text-xs text-green-400">✓</span>
              )}
              {idx + 1 === currentQuestion.questionNumber && (
                <span className="ml-2 text-xs">← Current</span>
              )}
            </div>
          ))}
        </div>

        {/* Live Leaderboard Section */}
        <div className="mt-8 pt-6 border-t border-zinc-700">
          <h3 className="text-zinc-100 mb-4 text-lg font-semibold flex items-center gap-2">
            🏆 Live Leaderboard
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
          </h3>
          {leaderboard.length > 0 ? (
            <div className="flex flex-col gap-2">
              {leaderboard.slice(0, 10).map((entry, idx) => (
                <div
                  key={entry.userId}
                  className={`p-3 rounded-lg text-sm transition-all ${
                    entry.userId === localStorage.getItem('userId')
                      ? 'bg-purple-600/30 border border-purple-500'
                      : idx === 0
                        ? 'bg-yellow-500/20 border border-yellow-500/50'
                        : idx === 1
                          ? 'bg-zinc-400/20 border border-zinc-400/50'
                          : idx === 2
                            ? 'bg-amber-600/20 border border-amber-600/50'
                            : 'bg-zinc-800 border border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${
                        idx === 0 ? 'text-yellow-400' :
                        idx === 1 ? 'text-zinc-300' :
                        idx === 2 ? 'text-amber-500' :
                        'text-zinc-400'
                      }`}>
                        #{entry.rank}
                      </span>
                      <span className={`truncate max-w-[100px] ${
                        entry.userId === localStorage.getItem('userId')
                          ? 'text-purple-300 font-semibold'
                          : 'text-zinc-300'
                      }`}>
                        {entry.userName}
                        {entry.userId === localStorage.getItem('userId') && ' (You)'}
                      </span>
                    </div>
                    <span className="text-purple-400 font-bold">{entry.score}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-zinc-500 text-sm">Waiting for participants...</p>
          )}
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
          <div className="flex items-center gap-4">
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
            <UserProfileDropdown />
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
              {/* Transition message - shows when next question is coming */}
              {transitionMessage && (
                <div className="mt-3 pt-3 border-t border-zinc-700 flex items-center gap-2 text-purple-400">
                  <div className="h-4 w-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                  <span className="text-sm font-medium">{transitionMessage}</span>
                </div>
              )}
            </div>
          )}

          {/* MCQ Options */}
          <div className="grid gap-3 mb-8">
            {!currentQuestion.mcqOptions || currentQuestion.mcqOptions.length === 0 ? (
              <div className="p-8 bg-red-500/10 border-2 border-red-500/50 rounded-xl text-center">
                <X className="h-12 w-12 text-red-400 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-red-400 mb-2">
                  Question Data Error
                </h3>
                <p className="text-zinc-300 text-sm">
                  MCQ options are missing. Please refresh the page or contact support.
                </p>
              </div>
            ) : (
              currentQuestion.mcqOptions.map((option, index) => {
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
              })
            )}
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
