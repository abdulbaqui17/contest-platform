import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { ContestSummary } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Trophy, Play } from 'lucide-react';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { PublicWebSocketService, type PublicWebSocketEvent } from '../services/websocket';

const UserContests: React.FC = () => {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchContests = async () => {
      try {
        const data = await contestsAPI.getAll();
        setContests(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load contests');
      } finally {
        setLoading(false);
      }
    };

    fetchContests();

    const wsService = new PublicWebSocketService(
      (event: PublicWebSocketEvent) => {
        if (event.event === 'contests_update') {
          setContests(event.data.contests);
        }
      },
      (err) => console.error('Public WebSocket error:', err),
      () => {}
    );

    wsService.connect(true);

    return () => wsService.disconnect();
  }, []);

  const handleJoin = async (contestId: string) => {
    setJoining(contestId);
    try {
      await contestsAPI.join(contestId);
      navigate(`/contest/${contestId}/play`);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to join contest');
      setJoining(null);
    }
  };

  const now = new Date();
  const activeContests = contests
    .filter(c => {
      const start = new Date(c.startAt);
      const end = new Date(c.endAt);
      return start <= now && end > now;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  
  const upcomingContests = contests
    .filter(c => {
      const start = new Date(c.startAt);
      return start > now;
    })
    .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  
  const pastContests = contests
    .filter(c => new Date(c.endAt) <= now)
    .sort((a, b) => new Date(b.endAt).getTime() - new Date(a.endAt).getTime());

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400">Loading contests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Contests</h1>
          <div className="flex items-center gap-3">
            <Button variant="secondary" onClick={() => navigate('/practice/coding')}>
              Practice Coding
            </Button>
            <Button variant="secondary" onClick={() => navigate('/practice/mcq')}>
              Practice MCQ
            </Button>
            <UserProfileDropdown />
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Active Contests Section */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-zinc-100 mb-4">Active Contests</h2>
          {activeContests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">No active contests at the moment. Check back soon!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {activeContests.map((contest) => (
                <Card key={contest.id} className="hover:border-zinc-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">{contest.title}</CardTitle>
                          <Badge variant="active">Active</Badge>
                        </div>
                        <CardDescription className="mb-3">{contest.description}</CardDescription>
                        <p className="text-sm text-zinc-500">
                          Started: {new Date(contest.startAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        onClick={() => handleJoin(contest.id)}
                        disabled={joining === contest.id}
                        variant="success"
                        size="lg"
                        className="ml-6"
                      >
                        {joining === contest.id ? (
                          'Joining...'
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Attempt
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Contests Section */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-zinc-100 mb-4">Upcoming Contests</h2>
          {upcomingContests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">No upcoming contests scheduled</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {upcomingContests.map((contest) => (
                <Card key={contest.id} className="hover:border-zinc-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">{contest.title}</CardTitle>
                          <Badge variant="default">Upcoming</Badge>
                        </div>
                        <CardDescription className="mb-3">{contest.description}</CardDescription>
                        <p className="text-sm text-zinc-500">
                          Starts: {new Date(contest.startAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Past Contests Section */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-4">Past Contests</h2>
          {pastContests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">No past contests available</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {pastContests.map((contest) => (
                <Card key={contest.id} className="hover:border-zinc-700 transition-colors">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <CardTitle className="text-lg">{contest.title}</CardTitle>
                          <Badge variant="past">{contest.status}</Badge>
                        </div>
                        <CardDescription className="mb-3">{contest.description}</CardDescription>
                        <p className="text-sm text-zinc-500">
                          Ended: {new Date(contest.endAt).toLocaleString()}
                        </p>
                      </div>
                      <Button variant="secondary" className="ml-6" disabled>
                        <Trophy className="h-4 w-4 mr-2" />
                        View Leaderboard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default UserContests;
