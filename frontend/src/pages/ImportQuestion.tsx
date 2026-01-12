import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ArrowLeft, Check } from 'lucide-react';

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
    <div className="min-h-screen bg-zinc-950">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-zinc-100">Import Questions</h1>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>

        {/* Question List */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Available Questions</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-zinc-800">
              {MOCK_QUESTIONS.map((question) => {
                const isImported = importedIds.has(question.id);
                
                return (
                  <div
                    key={question.id}
                    className="flex items-center justify-between px-6 py-4 hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className={`text-base ${isImported ? 'text-zinc-500' : 'text-zinc-100'}`}>
                      {question.title}
                    </span>
                    <Button
                      onClick={() => handleImport(question.id)}
                      disabled={isImported}
                      variant={isImported ? 'secondary' : 'success'}
                      size="sm"
                      className="min-w-[100px]"
                    >
                      {isImported ? (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Imported
                        </>
                      ) : (
                        'Import'
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ImportQuestion;
