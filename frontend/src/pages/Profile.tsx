import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  Trophy, Target, Flame, Calendar, Code, 
  CheckCircle, XCircle, Clock, ArrowLeft,
  TrendingUp, Award, Zap
} from 'lucide-react';
import { userStatsAPI } from '../services/api';

interface UserStats {
  totalSolved: number;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalAttempted: number;
  totalSubmissions: number;
  acceptedCount: number;
  acceptanceRate: number;
  contestsParticipated: number;
  bestContestRank: number | null;
  totalContestScore: number;
  currentStreak: number;
  maxStreak: number;
  lastActiveAt: string;
  recentSubmissions: Array<{
    id: string;
    question: { id: string; title: string; difficulty: string };
    language: string;
    status: string;
    runtime: number;
    submittedAt: string;
  }>;
  solvedProblems: Array<{
    questionId: string;
    title: string;
    difficulty: string;
    solvedAt: string;
  }>;
  languageDistribution: Array<{
    language: string;
    count: number;
  }>;
}

const Profile: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await userStatsAPI.getMyStats();
        setStats(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading profile...</div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
        <div className="text-lg text-red-600">{error || 'Failed to load profile'}</div>
        <Button onClick={() => navigate(-1)}>Go Back</Button>
      </div>
    );
  }

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HARD': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'WRONG_ANSWER':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'TIME_LIMIT_EXCEEDED':
        return <Clock className="h-4 w-4 text-orange-500" />;
      default:
        return <XCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const totalProblems = 100; // This should come from your API
  const progressPercentage = (stats.totalSolved / totalProblems) * 100;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <h1 className="text-2xl font-bold text-gray-900">My Profile</h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Stats Overview */}
          <div className="lg:col-span-1 space-y-6">
            {/* Progress Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-orange-500" />
                  Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center mb-6">
                  <div className="text-5xl font-bold text-orange-500">{stats.totalSolved}</div>
                  <div className="text-gray-500">Problems Solved</div>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
                  <div 
                    className="bg-orange-500 h-3 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                  />
                </div>

                {/* Difficulty Breakdown */}
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-green-600">{stats.easySolved}</div>
                    <div className="text-sm text-gray-500">Easy</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-yellow-600">{stats.mediumSolved}</div>
                    <div className="text-sm text-gray-500">Medium</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-red-600">{stats.hardSolved}</div>
                    <div className="text-sm text-gray-500">Hard</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Streak Card */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" />
                  Streak
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-500">{stats.currentStreak}</div>
                    <div className="text-sm text-gray-500">Current</div>
                  </div>
                  <div className="text-4xl text-gray-300">🔥</div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-gray-600">{stats.maxStreak}</div>
                    <div className="text-sm text-gray-500">Max</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Submission Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                  Submissions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total</span>
                  <span className="font-semibold">{stats.totalSubmissions}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Accepted</span>
                  <span className="font-semibold text-green-600">{stats.acceptedCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Acceptance Rate</span>
                  <span className="font-semibold">{stats.acceptanceRate.toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Contest Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Contests
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Participated</span>
                  <span className="font-semibold">{stats.contestsParticipated}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Best Rank</span>
                  <span className="font-semibold">
                    {stats.bestContestRank ? `#${stats.bestContestRank}` : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Score</span>
                  <span className="font-semibold">{stats.totalContestScore}</span>
                </div>
              </CardContent>
            </Card>

            {/* Language Distribution */}
            {stats.languageDistribution.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Code className="h-5 w-5 text-indigo-600" />
                    Languages
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stats.languageDistribution.map((lang) => (
                      <div key={lang.language} className="flex items-center justify-between">
                        <span className="text-gray-600 capitalize">{lang.language}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ 
                                width: `${(lang.count / Math.max(...stats.languageDistribution.map(l => l.count))) * 100}%` 
                              }}
                            />
                          </div>
                          <span className="text-sm font-medium w-8">{lang.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Submissions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-orange-500" />
                    Recent Submissions
                  </span>
                  <Link to="/submissions">
                    <Button variant="ghost" size="sm">View All</Button>
                  </Link>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentSubmissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No submissions yet. Start solving problems!
                  </div>
                ) : (
                  <div className="space-y-3">
                    {stats.recentSubmissions.map((sub) => (
                      <div 
                        key={sub.id}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {getStatusIcon(sub.status)}
                          <div>
                            <Link 
                              to={`/practice/coding/${sub.question.id}`}
                            className="font-medium text-gray-900 hover:text-orange-600"
                            >
                              {sub.question.title}
                            </Link>
                            <div className="flex items-center gap-2 text-sm text-gray-500">
                              <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(sub.question.difficulty)}`}>
                                {sub.question.difficulty}
                              </span>
                              <span className="capitalize">{sub.language}</span>
                              {sub.runtime && <span>{sub.runtime}ms</span>}
                            </div>
                          </div>
                        </div>
                        <div className="text-sm text-gray-500">
                          {new Date(sub.submittedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Solved Problems */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-green-600" />
                  Solved Problems ({stats.solvedProblems.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stats.solvedProblems.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No problems solved yet. 
                    <Link to="/practice/coding" className="text-orange-500 ml-1 hover:underline">
                      Start practicing!
                    </Link>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {stats.solvedProblems.slice(0, 10).map((problem) => (
                      <Link
                        key={problem.questionId}
                        to={`/practice/coding/${problem.questionId}`}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg hover:bg-green-100 transition-colors border border-green-200"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-gray-900">{problem.title}</span>
                        </div>
                        <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(problem.difficulty)}`}>
                          {problem.difficulty}
                        </span>
                      </Link>
                    ))}
                  </div>
                )}
                {stats.solvedProblems.length > 10 && (
                  <div className="text-center mt-4">
                    <Button variant="outline" size="sm">
                      Show All {stats.solvedProblems.length} Problems
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Activity Heatmap Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-gray-600" />
                  Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-gray-500">
                  Activity heatmap coming soon...
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile;
