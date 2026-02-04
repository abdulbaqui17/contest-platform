import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Check, FileCode, FileQuestion, Plus, Trash2 } from 'lucide-react';

type QuestionType = 'MCQ' | 'CODING' | 'DSA' | 'SANDBOX' | null;

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
  const [difficulty, setDifficulty] = useState<'EASY' | 'MEDIUM' | 'HARD'>('MEDIUM');
  const [functionName, setFunctionName] = useState('solution');
  const [timeLimitSec, setTimeLimitSec] = useState(2);
  const [memoryLimitMb, setMemoryLimitMb] = useState(256);
  const [options, setOptions] = useState<MCQOption[]>([
    { label: 'A', text: '', isCorrect: false },
    { label: 'B', text: '', isCorrect: false },
    { label: 'C', text: '', isCorrect: false },
    { label: 'D', text: '', isCorrect: false },
  ]);
  const [testCases, setTestCases] = useState<Array<{
    input: string;
    expectedOutput: string;
    isHidden: boolean;
  }>>([
    { input: '[[2,7,11,15],9]', expectedOutput: '[0,1]', isHidden: false },
    { input: '[[3,2,4],6]', expectedOutput: '[1,2]', isHidden: true },
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
      let newQuestion;
      if (selectedType === 'MCQ') {
        newQuestion = await questionsAPI.createStandalone({
          type: 'MCQ',
          title,
          description,
          options,
          points: 10,
          timeLimit: 120
        });
      } else if (selectedType === 'CODING' || selectedType === 'DSA' || selectedType === 'SANDBOX') {
        newQuestion = await questionsAPI.createStandalone({
          type: selectedType,
          title,
          description,
          difficulty,
          functionName: selectedType === 'SANDBOX' ? undefined : functionName,
          timeLimit: timeLimitSec * 1000,
          memoryLimit: memoryLimitMb,
          testCases: testCases.map((tc, index) => ({
            ...tc,
            order: index,
          }))
        });
      }
      
      if (!newQuestion) {
        throw new Error('Failed to create question');
      }
      
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

  const addTestCase = () => {
    setTestCases((prev) => [...prev, { input: '', expectedOutput: '', isHidden: false }]);
  };

  const updateTestCase = (index: number, field: 'input' | 'expectedOutput' | 'isHidden', value: string | boolean) => {
    setTestCases((prev) => prev.map((tc, i) => i === index ? { ...tc, [field]: value } : tc));
  };

  const removeTestCase = (index: number) => {
    setTestCases((prev) => prev.filter((_, i) => i !== index));
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
                <FileQuestion className="h-5 w-5 mr-3 text-orange-400" />
                <div>
                  <div className="font-semibold">MCQ</div>
                  <div className="text-sm text-zinc-500">Multiple Choice Question</div>
                </div>
              </Button>
              <Button
                onClick={() => setSelectedType('CODING')}
                variant="outline"
                size="lg"
                className="w-full justify-start h-16 text-left"
              >
                <FileCode className="h-5 w-5 mr-3 text-blue-400" />
                <div>
                  <div className="font-semibold">Coding</div>
                  <div className="text-sm text-zinc-500">LeetCode-style algorithm question</div>
                </div>
              </Button>
              <Button
                onClick={() => setSelectedType('DSA')}
                variant="outline"
                size="lg"
                className="w-full justify-start h-16 text-left"
              >
                <FileCode className="h-5 w-5 mr-3 text-green-400" />
                <div>
                  <div className="font-semibold">DSA</div>
                  <div className="text-sm text-zinc-500">Data structures & algorithms (tested)</div>
                </div>
              </Button>
              <Button
                onClick={() => setSelectedType('SANDBOX')}
                variant="outline"
                size="lg"
                className="w-full justify-start h-16 text-left"
              >
                <FileCode className="h-5 w-5 mr-3 text-amber-400" />
                <div>
                  <div className="font-semibold">Sandbox</div>
                  <div className="text-sm text-zinc-500">Generic stdin/stdout program</div>
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

  // CODING/DSA/SANDBOX Form
  if (selectedType === 'CODING' || selectedType === 'DSA' || selectedType === 'SANDBOX') {
    return (
      <div className="min-h-screen bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-bold text-zinc-100">Create {selectedType} Question</h1>
            <Button variant="secondary" onClick={() => setSelectedType(null)}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
          </div>

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
                  <Label htmlFor="description">Description (Markdown supported)</Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                    placeholder="Enter problem statement"
                    className="min-h-[160px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Difficulty</Label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value as 'EASY' | 'MEDIUM' | 'HARD')}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-md px-3 py-2 text-zinc-100"
                    >
                      <option value="EASY">Easy</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HARD">Hard</option>
                    </select>
                  </div>
                  {selectedType !== 'SANDBOX' && (
                    <div className="space-y-2">
                      <Label htmlFor="functionName">Function Name</Label>
                      <Input
                        id="functionName"
                        value={functionName}
                        onChange={(e) => setFunctionName(e.target.value)}
                        placeholder="solution"
                      />
                    </div>
                  )}
                </div>

                {selectedType === 'SANDBOX' && (
                  <div className="p-3 rounded-lg border border-amber-500/40 bg-amber-500/10 text-amber-300 text-sm">
                    Sandbox questions run as full programs. Read input from stdin and print output to stdout.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="timeLimit">Time Limit (seconds)</Label>
                    <Input
                      id="timeLimit"
                      type="number"
                      min={1}
                      value={timeLimitSec}
                      onChange={(e) => setTimeLimitSec(parseInt(e.target.value, 10))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="memoryLimit">Memory Limit (MB)</Label>
                    <Input
                      id="memoryLimit"
                      type="number"
                      min={32}
                      value={memoryLimitMb}
                      onChange={(e) => setMemoryLimitMb(parseInt(e.target.value, 10))}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Test Cases</Label>
                    <Button type="button" variant="secondary" size="sm" onClick={addTestCase}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Test
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {testCases.map((tc, index) => (
                      <div key={index} className="p-4 rounded-lg border border-zinc-700 bg-zinc-900 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-zinc-400">Test {index + 1}</span>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => removeTestCase(index)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label>{selectedType === 'SANDBOX' ? 'Input (stdin)' : 'Input (JSON)'}</Label>
                          <Input
                            value={tc.input}
                            onChange={(e) => updateTestCase(index, 'input', e.target.value)}
                            placeholder={
                              selectedType === 'SANDBOX'
                                ? 'Raw stdin input'
                                : '[ [2,7,11,15], 9 ] or {"nums":[...],"target":9}'
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{selectedType === 'SANDBOX' ? 'Expected Output' : 'Expected Output (JSON)'}</Label>
                          <Input
                            value={tc.expectedOutput}
                            onChange={(e) => updateTestCase(index, 'expectedOutput', e.target.value)}
                            placeholder='[0,1]'
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={tc.isHidden}
                            onChange={(e) => updateTestCase(index, 'isHidden', e.target.checked)}
                          />
                          <span className="text-sm text-zinc-400">Hidden test (for grading only)</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Button type="submit" variant="success" size="lg" className="w-full">
                  Create {selectedType} Question
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return null;
};

export default CreateQuestion;
