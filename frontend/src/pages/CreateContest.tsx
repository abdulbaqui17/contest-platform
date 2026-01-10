import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';

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
    <div className="container-sm" style={{ paddingTop: '2rem' }}>
      <div className="card" style={{ maxWidth: '700px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: 'var(--spacing-xl)' }}>Create New Contest</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title" className="form-label">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              className="form-input"
              placeholder="Enter contest title"
            />
          </div>
          <div className="form-group">
            <label htmlFor="description" className="form-label">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              className="form-input"
              style={{ minHeight: '100px', resize: 'vertical' }}
              placeholder="Enter contest description"
            />
          </div>
          <div className="form-group">
            <label htmlFor="startAt" className="form-label">Start Time</label>
            <input
              type="datetime-local"
              id="startAt"
              name="startAt"
              value={formData.startAt}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="endAt" className="form-label">End Time</label>
            <input
              type="datetime-local"
              id="endAt"
              name="endAt"
              value={formData.endAt}
              onChange={handleChange}
              required
              className="form-input"
            />
          </div>

          {/* Questions Section */}
          <div style={{ 
            marginTop: 'var(--spacing-xl)', 
            paddingTop: 'var(--spacing-xl)',
            borderTop: '1px solid var(--border-color)' 
          }}>
            <h3 style={{ 
              marginBottom: 'var(--spacing-lg)',
              color: 'var(--text-primary)',
              fontSize: '1.25rem'
            }}>
              Questions
            </h3>
            <div style={{ 
              display: 'flex', 
              gap: 'var(--spacing-md)',
              marginBottom: 'var(--spacing-lg)'
            }}>
              <button
                type="button"
                onClick={() => navigate('/admin/questions/import')}
                className="btn btn-secondary"
              >
                Import Question
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin/questions/new')}
                className="btn btn-primary"
              >
                Create New
              </button>
            </div>

            {/* Imported Questions List */}
            {importedQuestions.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                {importedQuestions.map((question, index) => (
                  <div
                    key={question.id}
                    style={{
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--border-radius)',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'rgba(102, 126, 234, 0.05)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ 
                        fontWeight: '500',
                        color: 'var(--text-primary)',
                        marginBottom: '0.25rem'
                      }}>
                        {index + 1}. {question.title}
                      </div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)'
                      }}>
                        Time: 20 mins • Points: 10
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {importedQuestions.length === 0 && (
              <div style={{
                padding: 'var(--spacing-lg)',
                textAlign: 'center',
                color: 'var(--text-secondary)',
                fontSize: '0.9rem',
                fontStyle: 'italic'
              }}>
                No questions added yet. Import or create questions to add them to this contest.
              </div>
            )}
          </div>

          {error && <div className="error-message">{error}</div>}
          <button
            type="submit"
            disabled={loading}
            className="btn btn-success btn-lg"
            style={{ width: '100%', marginTop: 'var(--spacing-lg)' }}
          >
            {loading ? 'Creating...' : 'Create Contest'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CreateContest;