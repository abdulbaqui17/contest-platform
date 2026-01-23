import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { 
  ArrowLeft, CheckCircle, XCircle, Clock, 
  AlertTriangle, Code, Filter, RefreshCw
} from 'lucide-react';
import { submissionsAPI } from '../services/api';

interface Submission {
  id: string;
  type: 'practice' | 'contest';
  contest?: { id: string; title: string };
  question: { id: string; title: string; difficulty: string };
  language: string;
  status: string;
  isCorrect?: boolean;
  runtime: number | null;
  memory: number | null;
  testCasesPassed: number | null;
  totalTestCases: number | null;
  submittedAt: string;
}

const Submissions: React.FC = () => {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'accepted' | 'rejected'>('all');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const limit = 20;

  useEffect(() => {
    fetchSubmissions();
  }, []);

  const fetchSubmissions = async (reset = false) => {
    try {
      setLoading(true);
      const newOffset = reset ? 0 : offset;
      const data = await submissionsAPI.getHistory(undefined, limit, newOffset);
      
      if (reset) {
        setSubmissions(data.submissions);
        setOffset(limit);
      } else {
        setSubmissions(prev => [...prev, ...data.submissions]);
        setOffset(prev => prev + limit);
      }
      
      setHasMore(data.submissions.length === limit);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACCEPTED':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'WRONG_ANSWER':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'TIME_LIMIT_EXCEEDED':
        return <Clock className="h-5 w-5 text-orange-500" />;
      case 'MEMORY_LIMIT_EXCEEDED':
        return <AlertTriangle className="h-5 w-5 text-orange-500" />;
      case 'RUNTIME_ERROR':
        return <AlertTriangle className="h-5 w-5 text-red-500" />;
      case 'COMPILATION_ERROR':
        return <Code className="h-5 w-5 text-red-500" />;
      case 'PENDING':
      case 'RUNNING':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <XCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'Accepted';
      case 'WRONG_ANSWER': return 'Wrong Answer';
      case 'TIME_LIMIT_EXCEEDED': return 'Time Limit Exceeded';
      case 'MEMORY_LIMIT_EXCEEDED': return 'Memory Limit Exceeded';
      case 'RUNTIME_ERROR': return 'Runtime Error';
      case 'COMPILATION_ERROR': return 'Compilation Error';
      case 'PENDING': return 'Pending';
      case 'RUNNING': return 'Running';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACCEPTED': return 'text-green-600 bg-green-50';
      case 'WRONG_ANSWER': return 'text-red-600 bg-red-50';
      case 'TIME_LIMIT_EXCEEDED': return 'text-orange-600 bg-orange-50';
      case 'MEMORY_LIMIT_EXCEEDED': return 'text-orange-600 bg-orange-50';
      case 'RUNTIME_ERROR': return 'text-red-600 bg-red-50';
      case 'COMPILATION_ERROR': return 'text-red-600 bg-red-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'EASY': return 'text-green-600 bg-green-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'HARD': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const filteredSubmissions = submissions.filter(sub => {
    if (filter === 'all') return true;
    if (filter === 'accepted') return sub.status === 'ACCEPTED';
    return sub.status !== 'ACCEPTED';
  });

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading && submissions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-600">Loading submissions...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
              <h1 className="text-2xl font-bold text-gray-900">My Submissions</h1>
            </div>
            
            {/* Filter Buttons */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
                <Button
                  variant={filter === 'all' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('all')}
                >
                  All
                </Button>
                <Button
                  variant={filter === 'accepted' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('accepted')}
                  className={filter === 'accepted' ? 'bg-green-600 hover:bg-green-700' : ''}
                >
                  Accepted
                </Button>
                <Button
                  variant={filter === 'rejected' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setFilter('rejected')}
                  className={filter === 'rejected' ? 'bg-red-600 hover:bg-red-700' : ''}
                >
                  Rejected
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {filteredSubmissions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Code className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No submissions yet</h3>
              <p className="text-gray-500 mb-4">
                Start solving problems to see your submissions here.
              </p>
              <Link to="/practice/coding">
                <Button>Start Coding</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Problem
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Language
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Runtime
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Memory
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Tests
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Submitted
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredSubmissions.map((sub) => (
                      <tr 
                        key={sub.id} 
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => navigate(`/submission/${sub.id}`)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(sub.status)}
                            <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(sub.status)}`}>
                              {getStatusLabel(sub.status)}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div>
                            <Link 
                              to={`/practice/coding/${sub.question.id}`}
                              className="text-gray-900 font-medium hover:text-purple-600"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {sub.question.title}
                            </Link>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`px-2 py-0.5 rounded text-xs ${getDifficultyColor(sub.question.difficulty)}`}>
                                {sub.question.difficulty}
                              </span>
                              {sub.type === 'contest' && sub.contest && (
                                <span className="text-xs text-gray-500">
                                  in {sub.contest.title}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="capitalize text-gray-600">{sub.language}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {sub.runtime !== null ? (
                            <span className="text-gray-900">{sub.runtime} ms</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {sub.memory !== null ? (
                            <span className="text-gray-900">{sub.memory.toFixed(1)} MB</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {sub.testCasesPassed !== null && sub.totalTestCases !== null ? (
                            <span className={sub.testCasesPassed === sub.totalTestCases ? 'text-green-600' : 'text-gray-600'}>
                              {sub.testCasesPassed}/{sub.totalTestCases}
                            </span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {formatDate(sub.submittedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Load More */}
              {hasMore && (
                <div className="p-4 text-center border-t">
                  <Button 
                    variant="outline" 
                    onClick={() => fetchSubmissions()}
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Load More'}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Submissions;
