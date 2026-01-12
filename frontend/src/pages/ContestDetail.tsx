import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { ContestDetail } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Monitor, FileQuestion, Clock, Trophy, Calendar } from 'lucide-react';

const ContestDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [contest, setContest] = useState<ContestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchContest = async () => {
      if (!id) return;
      try {
        const data = await contestsAPI.getById(id);
        setContest(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load contest');
      } finally {
        setLoading(false);
      }
    };

    fetchContest();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400">Loading contest...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 mb-4">{error}</p>
            <Link to="/admin/contests">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contests
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!contest) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-zinc-400 mb-4">Contest not found</p>
            <Link to="/admin/contests">
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Contests
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-5xl mx-auto px-6 py-8">
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
              <h1 className="text-2xl font-bold text-zinc-100">{contest.title}</h1>
              <p className="text-zinc-500">{contest.description}</p>
            </div>
          </div>
          <Badge variant={contest.status === 'ACTIVE' ? 'active' : 'past'}>
            {contest.status}
          </Badge>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-green-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">Start Time</p>
                <p className="text-lg font-medium text-zinc-100">{new Date(contest.startAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-red-500/20 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <p className="text-sm text-zinc-500">End Time</p>
                <p className="text-lg font-medium text-zinc-100">{new Date(contest.endAt).toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Questions Section */}
        <Card className="mb-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileQuestion className="h-5 w-5 text-purple-400" />
                Questions
              </CardTitle>
              <CardDescription>{contest.questions.length} questions in this contest</CardDescription>
            </div>
            <Link to={`/admin/contests/${id}/questions`}>
              <Button variant="success" size="sm">
                Manage Questions
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {contest.questions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-zinc-500">No questions added yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {contest.questions.map((question, index) => (
                  <div
                    key={question.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-zinc-800/50 border border-zinc-800"
                  >
                    <div className="flex items-center gap-4">
                      <span className="h-8 w-8 rounded-lg bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
                        {index + 1}
                      </span>
                      <span className="text-zinc-100 font-medium">{question.title}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1 text-zinc-400 text-sm">
                        <Trophy className="h-4 w-4" />
                        {question.points} pts
                      </div>
                      <div className="flex items-center gap-1 text-zinc-400 text-sm">
                        <Clock className="h-4 w-4" />
                        {question.timeLimit}s
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        {contest.status === 'ACTIVE' && (
          <div className="flex justify-end">
            <Link to={`/admin/contests/${id}/monitor`}>
              <Button variant="primary" size="lg">
                <Monitor className="h-5 w-5 mr-2" />
                Monitor Contest
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContestDetailPage;