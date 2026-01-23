import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { CircleHelp, Check, X } from 'lucide-react';
import UserProfileDropdown from '../components/UserProfileDropdown';
import { questionsAPI } from '../services/api';

interface MCQQuestion {
  id: string;
  title: string;
  description: string;
  type: string;
  createdAt: string;
  mcqOptions?: Array<{ id: string; text: string; isCorrect?: boolean }>;
}

const PracticeMCQ: React.FC = () => {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<MCQQuestion | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState({ correct: 0, total: 0 });

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const allQuestions = await questionsAPI.getAllStandalone();
        // Filter only MCQ questions
        const mcqQuestions = allQuestions.filter((q: any) => q.type === 'MCQ');
        setQuestions(mcqQuestions);
      } catch (error) {
        console.error('Failed to fetch questions:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, []);

  const startPractice = (question: MCQQuestion) => {
    setCurrentQuestion(question);
    setSelectedOption(null);
    setShowResult(false);
  };

  const handleSubmit = () => {
    if (!selectedOption || !currentQuestion?.mcqOptions) return;
    
    const correctOption = currentQuestion.mcqOptions.find(opt => opt.isCorrect);
    const isCorrect = selectedOption === correctOption?.id;
    
    setShowResult(true);
    setScore(prev => ({
      correct: prev.correct + (isCorrect ? 1 : 0),
      total: prev.total + 1
    }));
  };

  const nextQuestion = () => {
    if (!currentQuestion) return;
    const currentIndex = questions.findIndex(q => q.id === currentQuestion.id);
    if (currentIndex < questions.length - 1) {
      startPractice(questions[currentIndex + 1]);
    } else {
      // End of questions
      setCurrentQuestion(null);
    }
  };

  // Practice Mode View
  if (currentQuestion) {
    const correctOption = currentQuestion.mcqOptions?.find(opt => opt.isCorrect);
    
    return (
      <div className="min-h-screen bg-zinc-950">
        {/* Header */}
        <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4 flex justify-between items-center">
            <Button variant="secondary" onClick={() => setCurrentQuestion(null)}>
              ← Back to Questions
            </Button>
            <div className="flex items-center gap-4">
              <Badge variant="active">
                Score: {score.correct}/{score.total}
              </Badge>
              <UserProfileDropdown />
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-8">
              {/* Question */}
              <h2 className="text-2xl font-bold text-zinc-100 mb-6">
                {currentQuestion.title}
              </h2>
              <p className="text-zinc-400 mb-8 whitespace-pre-wrap">
                {currentQuestion.description}
              </p>

              {/* Options */}
              <div className="space-y-3 mb-8">
                {currentQuestion.mcqOptions?.map((option, index) => {
                  const isSelected = selectedOption === option.id;
                  const isCorrect = option.id === correctOption?.id;
                  
                  let optionClass = 'bg-zinc-800 border-zinc-700 hover:border-zinc-600';
                  if (showResult) {
                    if (isCorrect) {
                      optionClass = 'bg-green-900/30 border-green-600';
                    } else if (isSelected && !isCorrect) {
                      optionClass = 'bg-red-900/30 border-red-600';
                    }
                  } else if (isSelected) {
                    optionClass = 'bg-purple-900/30 border-purple-500';
                  }

                  return (
                    <button
                      key={option.id}
                      onClick={() => !showResult && setSelectedOption(option.id)}
                      disabled={showResult}
                      className={`w-full p-4 text-left rounded-xl border-2 transition-all flex items-center gap-4 ${optionClass} ${
                        showResult ? 'cursor-default' : 'cursor-pointer'
                      }`}
                    >
                      <span className={`w-8 h-8 flex items-center justify-center rounded-full font-semibold text-sm ${
                        isSelected && !showResult
                          ? 'bg-purple-500 text-white'
                          : showResult && isCorrect
                            ? 'bg-green-500 text-white'
                            : showResult && isSelected && !isCorrect
                              ? 'bg-red-500 text-white'
                              : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {showResult && isCorrect ? (
                          <Check className="h-4 w-4" />
                        ) : showResult && isSelected && !isCorrect ? (
                          <X className="h-4 w-4" />
                        ) : (
                          String.fromCharCode(65 + index)
                        )}
                      </span>
                      <span className="text-zinc-100">{option.text}</span>
                    </button>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="flex justify-between">
                {!showResult ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!selectedOption}
                    variant="primary"
                    size="lg"
                    className="w-full"
                  >
                    Check Answer
                  </Button>
                ) : (
                  <div className="w-full space-y-4">
                    <div className={`p-4 rounded-lg ${
                      selectedOption === correctOption?.id
                        ? 'bg-green-900/30 border border-green-600'
                        : 'bg-red-900/30 border border-red-600'
                    }`}>
                      <p className={`font-semibold ${
                        selectedOption === correctOption?.id ? 'text-green-400' : 'text-red-400'
                      }`}>
                        {selectedOption === correctOption?.id ? '✅ Correct!' : '❌ Incorrect'}
                      </p>
                      {selectedOption !== correctOption?.id && (
                        <p className="text-zinc-400 text-sm mt-1">
                          The correct answer was: {correctOption?.text}
                        </p>
                      )}
                    </div>
                    <Button onClick={nextQuestion} variant="primary" size="lg" className="w-full">
                      {questions.findIndex(q => q.id === currentQuestion.id) < questions.length - 1
                        ? 'Next Question →'
                        : 'Finish Practice'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Questions List View
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <CircleHelp className="h-8 w-8 text-purple-500" />
            <h1 className="text-2xl font-bold text-zinc-100">Practice MCQ</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="secondary" onClick={() => navigate('/contests')}>
              Contests
            </Button>
            <Button variant="secondary" onClick={() => navigate('/practice/coding')}>
              Practice Coding
            </Button>
            <UserProfileDropdown />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Hero Section */}
        <div className="mb-8 p-6 bg-gradient-to-r from-purple-900/30 to-violet-900/30 rounded-xl border border-purple-800/50">
          <h2 className="text-3xl font-bold text-zinc-100 mb-2">
            📝 Multiple Choice Questions
          </h2>
          <p className="text-zinc-400">
            Practice MCQ questions at your own pace. Test your knowledge across various topics.
          </p>
          {score.total > 0 && (
            <div className="mt-4 inline-block px-4 py-2 bg-purple-600/30 rounded-lg">
              <span className="text-purple-300 font-medium">
                Session Score: {score.correct}/{score.total} ({Math.round((score.correct / score.total) * 100)}%)
              </span>
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-zinc-100">{questions.length}</div>
              <div className="text-sm text-zinc-400">Total Questions</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-green-400">{score.correct}</div>
              <div className="text-sm text-zinc-400">Correct Answers</div>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4 text-center">
              <div className="text-3xl font-bold text-purple-400">{score.total}</div>
              <div className="text-sm text-zinc-400">Attempted</div>
            </CardContent>
          </Card>
        </div>

        {/* Questions List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : questions.length === 0 ? (
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-12 text-center">
              <CircleHelp className="h-12 w-12 text-zinc-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-zinc-300 mb-2">No MCQ Questions Yet</h3>
              <p className="text-zinc-500">Check back later for new questions!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {questions.map((question, index) => (
              <Card 
                key={question.id} 
                className="bg-zinc-900 border-zinc-800 hover:border-purple-600/50 transition-all cursor-pointer"
                onClick={() => startPractice(question)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="text-zinc-500 font-mono w-8">{index + 1}.</span>
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-100 hover:text-purple-400 transition-colors">
                          {question.title}
                        </h3>
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-1">
                          {question.description}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/50">
                        {question.mcqOptions?.length || 0} options
                      </Badge>
                      <Button variant="primary" size="sm">
                        Practice
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Start All Button */}
        {questions.length > 0 && (
          <div className="mt-8 text-center">
            <Button 
              variant="primary" 
              size="lg" 
              onClick={() => startPractice(questions[0])}
              className="px-8"
            >
              🚀 Start Practice Session
            </Button>
          </div>
        )}
      </main>
    </div>
  );
};

export default PracticeMCQ;
