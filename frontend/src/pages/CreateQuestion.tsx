import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Check, FileCode, FileQuestion, Box } from 'lucide-react';

type QuestionType = 'MCQ' | 'DSA' | 'Sandbox' | null;

interface MCQOption {
  label: string;
  text: string;
  isCorrect: boolean;
}

const CreateQuestion: React.FC = () => {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<QuestionType>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<MCQOption[]>([
    { label: 'A', text: '', isCorrect: false },
    { label: 'B', text: '', isCorrect: false },
    { label: 'C', text: '', isCorrect: false },
    { label: 'D', text: '', isCorrect: false },
  ]);

  const handleOptionTextChange = (index: number, text: string) => {
    const newOptions = [...options];
    newOptions[index].text = text;
    setOptions(newOptions);
  };

  const handleCorrectAnswerChange = (index: number) => {
    const newOptions = options.map((opt, i) => ({
      ...opt,
      isCorrect: i === index,
    }));
    setOptions(newOptions);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Save question to database via API
      const newQuestion = await questionsAPI.createStandalone({
        type: 'MCQ',
        title,
        description,
        options,
        points: 10,
        timeLimit: 120
      });
      
      // Add to localStorage for CreateContest page
      const existingStr = localStorage.getItem('imported_questions');
      const existing = existingStr ? JSON.parse(existingStr) : [];
      existing.push({
        id: newQuestion.id,
        title: newQuestion.title,
        points: 10,
        timeLimit: 120
      });
      localStorage.setItem('imported_questions', JSON.stringify(existing));
      
      // Navigate back to create contest
      navigate('/admin/contests/new');
    } catch (error) {
      console.error('Error creating question:', error);
      alert('Failed to create question');
    }
  };

  // Type Selection Screen
  if (!selectedType) {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-zinc-100">Create New Question</h1>
            <Button variant="secondary" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          {/* Type Selection */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Select Question Type</CardTitle>
              <CardDescription>Choose the type of question you want to create</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                onClick={() => setSelectedType('MCQ')}
                variant="outline"
                size="lg"
                className="w-full justify-start h-16 text-left"
              >
                <FileQuestion className="h-5 w-5 mr-3 text-purple-400" />
                <div>
                  <div className="font-semibold">MCQ</div>
                  <div className="text-sm text-zinc-500">Multiple Choice Question</div>
                </div>
              </Button>
              <Button
                onClick={() => setSelectedType('DSA')}
                variant="outline"
                size="lg"
                className="w-full justify-start h-16 text-left"
              >
                <FileCode className="h-5 w-5 mr-3 text-blue-400" />
                <div>
                  <div className="font-semibold">DSA</div>
                  <div className="text-sm text-zinc-500">Data Structures & Algorithms</div>
                </div>
              </Button>
              <Button
                onClick={() => setSelectedType('Sandbox')}
                variant="outline"
                size="lg"
                className="w-full justify-start h-16 text-left"
              >
                <Box className="h-5 w-5 mr-3 text-green-400" />
                <div>
                  <div className="font-semibold">Sandbox</div>
                  <div className="text-sm text-zinc-500">Free-form coding environment</div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // MCQ Form
  if (selectedType === 'MCQ') {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="max-w-2xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-zinc-100">Create MCQ Question</h1>
            <Button variant="secondary" onClick={() => setSelectedType(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

          {/* Form */}
          <Card>
            <CardContent className="p-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Enter question title"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Enter question description"
                    className="min-h-[120px]"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Options</Label>
                  {options.map((option, index) => (
                    <div
                      key={option.label}
                      className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-colors ${
                        option.isCorrect
                          ? 'border-green-500/50 bg-green-500/10'
                          : 'border-zinc-700 bg-zinc-800/50'
                      }`}
                    >
                      <span
                        className={`font-bold min-w-[30px] ${
                          option.isCorrect ? 'text-green-400' : 'text-zinc-500'
                        }`}
                      >
                        {option.label}.
                      </span>
                      <Input
                        value={option.text}
                        onChange={(e) => handleOptionTextChange(index, e.target.value)}
                        required
                        placeholder={`Enter option ${option.label}`}
                        className="flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => handleCorrectAnswerChange(index)}
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
                </div>

                <Button type="submit" variant="success" size="lg" className="w-full">
                  Create Question
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Coming Soon for DSA/Sandbox
  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Card className="max-w-md w-full text-center">
        <CardHeader>
          <CardTitle>{selectedType} Question</CardTitle>
          <CardDescription>
            {selectedType} question form coming soon...
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" onClick={() => setSelectedType(null)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CreateQuestion;
