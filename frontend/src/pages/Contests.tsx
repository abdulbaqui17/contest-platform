import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { ContestSummary } from '../types';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Plus, LogOut, Monitor, Pencil, Trash2, Eye } from 'lucide-react';
import { PublicWebSocketService, type PublicWebSocketEvent } from '../services/websocket';

const Contests: React.FC = () => {
  const [contests, setContests] = useState<ContestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin/login');
  };

  const handleDelete = async (contestId: string) => {
    if (!confirm('Are you sure you want to delete this contest?')) {
      return;
    }

    try {
      await contestsAPI.delete(contestId);
      setContests(contests.filter(c => c.id !== contestId));
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete contest');
    }
  };

  // Format date to local time string for display
  // The date from backend is in UTC, toLocaleString converts to user's local timezone
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    console.log('🕐 Display time:', { 
      input: dateString, 
      asLocal: date.toLocaleString(),
      asUTC: date.toISOString()
    });
    return date.toLocaleString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
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
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-zinc-100">Contest Management</h1>
          <div className="flex items-center gap-3">
            <Link to="/admin/contests/new">
              <Button variant="success">
                <Plus className="h-4 w-4 mr-2" />
                Create New Contest
              </Button>
            </Link>
            <Button variant="secondary" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 text-red-400 mb-6">
            {error}
          </div>
        )}

        {/* Upcoming Contests */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-zinc-100 mb-4">Upcoming Contests</h2>
          {upcomingContests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">No upcoming contests</p>
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
                        <CardDescription className="mb-4">{contest.description}</CardDescription>
                        <div className="text-sm text-zinc-500 space-y-1">
                          <div>Start: {formatTime(contest.startAt)}</div>
                          <div>End: {formatTime(contest.endAt)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <Link to={`/admin/contests/${contest.id}`}>
                          <Button variant="secondary" size="sm">
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(contest.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Active Contests */}
        <section className="mb-10">
          <h2 className="text-xl font-semibold text-zinc-100 mb-4">Active Contests</h2>
          {activeContests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">No active contests</p>
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
                        <CardDescription className="mb-4">{contest.description}</CardDescription>
                        <div className="text-sm text-zinc-500 space-y-1">
                          <div>Start: {formatTime(contest.startAt)}</div>
                          <div>End: {formatTime(contest.endAt)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <Link to={`/admin/contests/${contest.id}/monitor`}>
                          <Button variant="primary" size="sm">
                            <Monitor className="h-4 w-4 mr-2" />
                            Monitor
                          </Button>
                        </Link>
                        <Link to={`/admin/contests/${contest.id}`}>
                          <Button variant="secondary" size="sm">
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(contest.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Past Contests */}
        <section>
          <h2 className="text-xl font-semibold text-zinc-100 mb-4">Past Contests</h2>
          {pastContests.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">No past contests</p>
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
                        <CardDescription className="mb-4">{contest.description}</CardDescription>
                        <div className="text-sm text-zinc-500 space-y-1">
                          <div>Start: {formatTime(contest.startAt)}</div>
                          <div>End: {formatTime(contest.endAt)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-6">
                        <Link to={`/admin/contests/${contest.id}`}>
                          <Button variant="secondary" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View Details
                          </Button>
                        </Link>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(contest.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </Button>
                      </div>
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

export default Contests;
