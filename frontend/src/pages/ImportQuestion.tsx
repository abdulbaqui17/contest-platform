import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface Question {
  id: number;
  title: string;
}

const MOCK_QUESTIONS: Question[] = [
  { id: 1, title: '2 sum' },
  { id: 2, title: 'todo app' },
  { id: 3, title: 'redux mcq' },
];

const ImportQuestion: React.FC = () => {
  const navigate = useNavigate();
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  const handleImport = (id: number) => {
    const question = MOCK_QUESTIONS.find(q => q.id === id);
    if (!question) return;

    // Get existing imported questions from localStorage
    const existingStr = localStorage.getItem('imported_questions');
    const existing = existingStr ? JSON.parse(existingStr) : [];
    
    // Add new question if not already imported
    if (!existing.some((q: Question) => q.id === id)) {
      existing.push(question);
      localStorage.setItem('imported_questions', JSON.stringify(existing));
    }
    
    setImportedIds(prev => new Set([...prev, id]));
  };

  return (
    <div className="container-sm" style={{ paddingTop: '2rem' }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: 'var(--spacing-xl)'
        }}>
          <h2>Import Questions</h2>
          <button onClick={() => navigate(-1)} className="btn btn-secondary">
            Back
          </button>
        </div>

        <div className="card">
          {MOCK_QUESTIONS.map((question) => {
            const isImported = importedIds.has(question.id);
            
            return (
              <div
                key={question.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--spacing-md)',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                <span style={{ 
                  fontSize: '1rem',
                  color: isImported ? 'var(--text-secondary)' : 'var(--text-primary)',
                }}>
                  {question.title}
                </span>
                <button
                  onClick={() => handleImport(question.id)}
                  disabled={isImported}
                  className={isImported ? 'btn btn-secondary' : 'btn btn-success'}
                  style={{ minWidth: '100px' }}
                >
                  {isImported ? 'Imported' : 'Import'}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ImportQuestion;
