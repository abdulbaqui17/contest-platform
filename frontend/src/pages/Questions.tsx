import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { questionsAPI } from '../services/api';
import { QuestionDetail, CreateQuestionRequest } from '../types';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { ArrowLeft, Plus, X, Check, Clock, Trophy } from 'lucide-react';

const Questions: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [questions, setQuestions] = useState<QuestionDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateQuestionRequest>({
    type: 'MCQ',
    title: '',
    description: '',
    options: [{ text: '', isCorrect: false }],
    points: 10,
    timeLimit: 60,
  });

  useEffect(() => {
    const fetchQuestions = async () => {
      if (!id) return;
      try {
        const data = await questionsAPI.getAll(id);
        setQuestions(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestions();
  }, [id]);

  const handleCreateQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    try {
      const newQuestion = await questionsAPI.create(id, formData);
      setQuestions([...questions, newQuestion]);
      setShowForm(false);
      setFormData({
        type: 'MCQ',
        title: '',
        description: '',
        options: [{ text: '', isCorrect: false }],
        points: 10,
        timeLimit: 60,
      });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create question');
    }
  };

  const addOption = () => {
    setFormData({
      ...formData,
      options: [...formData.options, { text: '', isCorrect: false }],
    });
  };

  const updateOption = (index: number, field: 'text' | 'isCorrect', value: string | boolean) => {
    const newOptions = [...formData.options];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, options: newOptions });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-8 w-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-400">Loading questions...</p>
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

  return (
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link to={`/admin/contests/${id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back
              </Button>
            </Link>
            <h1 className="text-2xl font-bold text-zinc-100">Contest Questions</h1>
          </div>
          <Button onClick={() => setShowForm(!showForm)} variant={showForm ? 'secondary' : 'success'}>
            {showForm ? (
              <>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Add Question
              </>
            )}
          </Button>
        </div>

        {/* Add Question Form */}
        {showForm && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Create New Question</CardTitle>
              <CardDescription>Add a new MCQ question to this contest</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreateQuestion} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    required
                    placeholder="Enter question title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    required
                    placeholder="Enter question description"
                    className="min-h-[100px]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="points">Points</Label>
                    <Input
                      id="points"
                      type="number"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      value={formData.timeLimit}
                      onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label>Options</Label>
                  {formData.options.map((option, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                        option.isCorrect
                          ? 'border-green-500/50 bg-green-500/10'
                          : 'border-zinc-700 bg-zinc-800/50'
                      }`}
                    >
                      <Input
                        value={option.text}
                        onChange={(e) => updateOption(index, 'text', e.target.value)}
                        required
                        placeholder={`Option ${index + 1}`}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => updateOption(index, 'isCorrect', !option.isCorrect)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                          option.isCorrect
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-zinc-700/50 text-zinc-400 hover:bg-zinc-700'
                        }`}
                      >
                        {option.isCorrect && <Check className="h-4 w-4" />}
                        {option.isCorrect ? 'Correct' : 'Mark Correct'}
                      </button>
                    </div>
                  ))}
                  <Button type="button" onClick={addOption} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Option
                  </Button>
                </div>
                <Button type="submit" variant="success" className="w-full">
                  Create Question
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Question List */}
        <div className="space-y-4">
          {questions.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">No questions added yet</p>
              </CardContent>
            </Card>
          ) : (
            questions.map((question, index) => (
              <Card key={question.id}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="h-8 w-8 rounded-lg bg-zinc-700 flex items-center justify-center text-sm font-medium text-zinc-300">
                        {index + 1}
                      </span>
                      <h3 className="text-lg font-semibold text-zinc-100">{question.title}</h3>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="default" className="flex items-center gap-1">
                        <Trophy className="h-3 w-3" />
                        {question.points} pts
                      </Badge>
                      <Badge variant="default" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {question.timeLimit}s
                      </Badge>
                    </div>
                  </div>
                  <p className="text-zinc-400 mb-4">{question.description}</p>
                  <div className="space-y-2">
                    {question.options.map((option, optIndex) => (
                      <div
                        key={optIndex}
                        className={`p-3 rounded-lg border ${
                          option.isCorrect
                            ? 'border-green-500/50 bg-green-500/10 text-green-400'
                            : 'border-zinc-700 bg-zinc-800/50 text-zinc-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {option.isCorrect && <Check className="h-4 w-4" />}
                          {option.text}
                          {option.isCorrect && <span className="text-xs ml-auto">(Correct)</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Questions;