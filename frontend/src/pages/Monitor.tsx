import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ContestWebSocketService } from '../services/websocket';
import { WebSocketEvent, LeaderboardUpdateEvent, QuestionBroadcastEvent } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { ArrowLeft, Users, FileCheck, Clock, Trophy } from 'lucide-react';

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
        setSubmissionCount(event.data.topN.reduce((sum, entry) => sum + entry.questionsAnswered, 0));
        break;
      case 'contest_end':
        setCurrentQuestion(null);
        setTimer(null);
        break;
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.ceil(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to="/admin/contests">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-zinc-100">Contest Monitor</h1>
              <p className="text-zinc-500 text-sm">Contest ID: {id}</p>
            </div>
          </div>
          <Badge variant="active" className="h-8 px-4">
            <span className="h-2 w-2 bg-green-400 rounded-full mr-2 animate-pulse" />
            Live
          </Badge>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Users className="h-6 w-6 text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Participants</p>
                <p className="text-2xl font-bold text-zinc-100">{totalParticipants}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <FileCheck className="h-6 w-6 text-blue-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Total Submissions</p>
                <p className="text-2xl font-bold text-zinc-100">{submissionCount}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Clock className="h-6 w-6 text-orange-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Time Remaining</p>
                <p className="text-2xl font-bold text-zinc-100">
                  {timer ? formatTime(timer.remaining) : '--:--'}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-2 gap-6">
          {/* Current Question */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileCheck className="h-5 w-5 text-purple-400" />
                Current Question
              </CardTitle>
            </CardHeader>
            <CardContent>
              {currentQuestion ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-lg font-semibold text-zinc-100 mb-2">{currentQuestion.title}</h4>
                    <p className="text-zinc-400">{currentQuestion.description}</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Badge variant="default">{currentQuestion.points} points</Badge>
                    {timer && (
                      <Badge variant="active">
                        {formatTime(timer.remaining)} remaining
                      </Badge>
                    )}
                  </div>
                  {currentQuestion.mcqOptions && (
                    <div className="space-y-2 mt-4">
                      {currentQuestion.mcqOptions.map((option) => (
                        <div
                          key={option.id}
                          className="p-3 rounded-lg bg-zinc-800/50 border border-zinc-700 text-zinc-300"
                        >
                          {option.text}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-zinc-500">No active question</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Leaderboard */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-yellow-400" />
                Live Leaderboard
              </CardTitle>
              <CardDescription>Top participants by score</CardDescription>
            </CardHeader>
            <CardContent>
              {leaderboard.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-zinc-500">No submissions yet</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-zinc-800/50">
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">Rank</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400 uppercase tracking-wider">User</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Score</th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-zinc-400 uppercase tracking-wider">Answered</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                      {leaderboard.map((entry) => (
                        <tr key={entry.userId} className="hover:bg-zinc-800/30 transition-colors">
                          <td className="px-4 py-3 text-zinc-100 font-medium">
                            {entry.rank <= 3 ? (
                              <span className={`inline-flex items-center justify-center h-6 w-6 rounded-full ${
                                entry.rank === 1 ? 'bg-yellow-500/20 text-yellow-400' :
                                entry.rank === 2 ? 'bg-zinc-400/20 text-zinc-300' :
                                'bg-orange-500/20 text-orange-400'
                              }`}>
                                {entry.rank}
                              </span>
                            ) : entry.rank}
                          </td>
                          <td className="px-4 py-3 text-zinc-300">{entry.userName}</td>
                          <td className="px-4 py-3 text-right text-zinc-100 font-semibold">{entry.score}</td>
                          <td className="px-4 py-3 text-right text-zinc-400">{entry.questionsAnswered}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Monitor;