import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';
import { Trash2 } from 'lucide-react';

interface ImportedQuestion {
  id: string;
  title: string;
  points?: number;
  timeLimit?: number;
}
import { CreateContestRequest } from '../types';

// Helper function to convert ISO date string to datetime-local format (YYYY-MM-DDTHH:MM)
const toDateTimeLocalString = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const CreateContest: React.FC = () => {
  const [formData, setFormData] = useState<CreateContestRequest>({
    title: '',
    description: '',
    startAt: '',
    endAt: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [importedQuestions, setImportedQuestions] = useState<ImportedQuestion[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    // Load imported questions from localStorage
    const loadImportedQuestions = () => {
      const stored = localStorage.getItem('imported_questions');
      if (stored) {
        setImportedQuestions(JSON.parse(stored));
      }
    };

    loadImportedQuestions();

    // Listen for storage changes (when questions are imported)
    const handleStorageChange = () => {
      loadImportedQuestions();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('focus', loadImportedQuestions);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('focus', loadImportedQuestions);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // datetime-local input gives us "YYYY-MM-DDTHH:MM" in LOCAL time (no timezone info)
    // new Date() will parse this as local time
    const startDate = new Date(formData.startAt);
    const endDate = new Date(formData.endAt);
    const now = new Date();

    console.log('🕐 Time Debug:');
    console.log('  Input strings:', { startAt: formData.startAt, endAt: formData.endAt });
    console.log('  Parsed as local:', { 
      start: startDate.toString(), 
      end: endDate.toString() 
    });
    console.log('  Converted to ISO (UTC):', { 
      start: startDate.toISOString(), 
      end: endDate.toISOString() 
    });
    console.log('  Timezone offset (minutes):', new Date().getTimezoneOffset());

    // Validation - allow immediate start but prevent past dates
    if (startDate < now) {
      setError('Contest start time cannot be in the past');
      setLoading(false);
      return;
    }

    if (startDate >= endDate) {
      setError('End time must be after start time');
      setLoading(false);
      return;
    }

    // Check if contest duration exceeds 24 hours
    const durationInHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
    if (durationInHours > 24) {
      setError('Contest duration cannot exceed 24 hours');
      setLoading(false);
      return;
    }

    try {
      // Prepare questions data
      const questionsData = importedQuestions.map(q => ({
        id: String(q.id), // Convert to string to match database UUID type
        points: q.points || 10,
        timeLimit: q.timeLimit || 120
      }));

      // Send ISO strings (UTC) to backend
      const payload = {
        title: formData.title,
        description: formData.description,
        startAt: startDate.toISOString(),
        endAt: endDate.toISOString(),
        questions: questionsData
      };

      console.log('📤 Payload to backend:', payload);

      await contestsAPI.create(payload);
      
      // Clear localStorage after successful creation
      localStorage.removeItem('imported_questions');
      
      navigate('/admin/contests');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create contest');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleDeleteQuestion = (questionId: string) => {
    const updatedQuestions = importedQuestions.filter(q => q.id !== questionId);
    setImportedQuestions(updatedQuestions);
    localStorage.setItem('imported_questions', JSON.stringify(updatedQuestions));
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-start justify-center p-8">
      <Card className="w-full max-w-4xl p-10">
        <h1 className="text-3xl font-semibold text-white mb-8">Create new contest</h1>
        
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Details Section */}
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Details</p>
            
            <div className="grid grid-cols-2 gap-6 mb-6">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-zinc-300 mb-2">
                  Title
                </label>
                <Input
                  type="text"
                  id="title"
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  placeholder="Enter contest title"
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-zinc-300 mb-2">
                  Description
                </label>
                <Input
                  type="text"
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  required
                  placeholder="Enter contest description"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label htmlFor="startAt" className="block text-sm font-medium text-zinc-300 mb-2">
                  Start date
                </label>
                <Input
                  type="datetime-local"
                  id="startAt"
                  name="startAt"
                  value={formData.startAt}
                  onChange={handleChange}
                  min={toDateTimeLocalString(new Date())}
                  required
                />
              </div>
              <div>
                <label htmlFor="endAt" className="block text-sm font-medium text-zinc-300 mb-2">
                  End date (max 24 hours from start)
                </label>
                <Input
                  type="datetime-local"
                  id="endAt"
                  name="endAt"
                  value={formData.endAt}
                  onChange={handleChange}
                  min={formData.startAt || toDateTimeLocalString(new Date())}
                  max={formData.startAt ? toDateTimeLocalString(new Date(new Date(formData.startAt).getTime() + 24 * 60 * 60 * 1000)) : undefined}
                  required
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Questions Section */}
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-white">Questions</h2>
              <div className="flex gap-3">
                <Button
                  type="button"
                  onClick={() => navigate('/admin/questions/import')}
                  variant="outline"
                >
                  Import question
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate('/admin/questions/new')}
                  variant="outline"
                >
                  Create new
                </Button>
              </div>
            </div>

            {/* Questions List */}
            {importedQuestions.length > 0 && (
              <div className="space-y-3">
                {importedQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    className="bg-zinc-850 border border-zinc-800 rounded-lg p-4 flex items-center justify-between"
                  >
                    <div>
                      <p className="text-white font-medium mb-1">
                        {index + 1}. {question.title}
                      </p>
                      <div className="flex items-center gap-2">
                        <Badge variant="default" className="text-xs">⏱ 20 mins</Badge>
                        <Badge variant="default" className="text-xs">🏆 10 points</Badge>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteQuestion(question.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {importedQuestions.length === 0 && (
              <div className="border-2 border-dashed border-zinc-800 rounded-lg p-8 text-center">
                <p className="text-zinc-500 text-sm italic">
                  No questions added yet. Import or create questions to add them to this contest.
                </p>
              </div>
            )}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
              {error}
            </div>
          )}

          <Separator />

          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading}
              variant="success"
              size="lg"
            >
              {loading ? 'Creating...' : 'Create Contest'}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateContest;