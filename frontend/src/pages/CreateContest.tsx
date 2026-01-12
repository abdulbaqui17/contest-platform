import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Separator } from '../components/ui/separator';

interface ImportedQuestion {
  id: number;
  title: string;
}
import { CreateContestRequest } from '../types';

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

    // Validation
    if (new Date(formData.startAt) >= new Date(formData.endAt)) {
      setError('Start time must be before end time');
      setLoading(false);
      return;
    }

    try {
      await contestsAPI.create(formData);
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
                  required
                />
              </div>
              <div>
                <label htmlFor="endAt" className="block text-sm font-medium text-zinc-300 mb-2">
                  End date
                </label>
                <Input
                  type="datetime-local"
                  id="endAt"
                  name="endAt"
                  value={formData.endAt}
                  onChange={handleChange}
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