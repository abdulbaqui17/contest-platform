import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Code, Clock, Cpu } from 'lucide-react';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { questionsAPI } from '../services/api';

interface CodingQuestion {
  id: string;
  title: string;
  description: string;
  type: string;
  timeLimit: number | null;
  memoryLimit: number | null;
  createdAt: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

const PracticeCoding: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<CodingQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'Easy' | 'Medium' | 'Hard'>('all');

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const allQuestions = await questionsAPI.getAllStandalone();
        // Filter coding/DSA/sandbox questions
        const codingQuestions = allQuestions.filter((q: any) => ['CODING', 'DSA', 'SANDBOX'].includes(q.type));
        const withDifficulty = codingQuestions.map((q: any) => ({
          ...q,
          difficulty: q.difficulty === 'EASY' ? 'Easy' : q.difficulty === 'HARD' ? 'Hard' : 'Medium'
        }));
        setQuestions(withDifficulty);
      } catch (error) {
        console.error('Failed to fetch questions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const filteredQuestions = filter === 'all' 
    ? questions 
    : questions.filter(q => q.difficulty === filter);

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-green-500/20 text-green-400 border-green-500/50';
      case 'Medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50';
      case 'Hard': return 'bg-red-500/20 text-red-400 border-red-500/50';
      default: return 'bg-zinc-500/20 text-zinc-400 border-zinc-500/50';
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Code className="h-8 w-8 text-green-500" />
            <h1 className="text-2xl font-bold text-zinc-100">Practice Coding</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/contests')}>
              Contests
            </Button>
            <Button variant="secondary" onClick={() => navigate('/practice/mcq')}>
              Practice MCQ
            </Button>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-8 p-6 bg-gradient-to-r from-green-900/30 to-emerald-900/30 rounded-xl border border-green-800/50">
          <h2 className="text-3xl font-bold text-zinc-100 mb-2">
            🧑‍💻 LeetCode-Style Coding Problems
          </h2>
          <p className="text-zinc-400">
            Practice coding problems at your own pace. No time pressure, no contests - just pure problem solving.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-3 mb-6">
          {(['all', 'Easy', 'Medium', 'Hard'] as const).map((level) => (
            <button
              key={level}
              onClick={() => setFilter(level)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                filter === level
                  ? 'bg-green-600 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {level === 'all' ? 'All Problems' : level}
            </button>
          ))}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-zinc-100">{questions.length}</div>
              <div className="text-sm text-zinc-400">Total Problems</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-400">
                {questions.filter(q => q.difficulty === 'Easy').length}
              </div>
              <div className="text-sm text-zinc-400">Easy</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-yellow-400">
                {questions.filter(q => q.difficulty === 'Medium').length}
              </div>
              <div className="text-sm text-zinc-400">Medium</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-red-400">
                {questions.filter(q => q.difficulty === 'Hard').length}
              </div>
              <div className="text-sm text-zinc-400">Hard</div>
            </CardContent>
          </Card>
        </div>

        {/* Problems List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredQuestions.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-12 text-center">
              <Code className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-zinc-300 mb-2">No Coding Problems Yet</h3>
              <p className="text-zinc-500">Check back later for new challenges!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredQuestions.map((question, index) => (
              <Card 
                key={question.id} 
                className="bg-zinc-900 border-zinc-800 hover:border-green-600/50 transition-all cursor-pointer"
                onClick={() => navigate(`/practice/coding/${question.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500 font-mono w-8">{index + 1}.</span>
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-100 hover:text-green-400 transition-colors">
                          {question.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-zinc-500">
                          {question.timeLimit && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {question.timeLimit}ms
                            </span>
                          )}
                          {question.memoryLimit && (
                            <span className="flex items-center gap-1">
                              <Cpu className="h-3 w-3" />
                              {question.memoryLimit}MB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={getDifficultyColor(question.difficulty || 'Medium')}>
                        {question.difficulty}
                      </Badge>
                      <Button variant="primary" size="sm">
                        Solve
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PracticeCoding;
