import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Question Data:', {
      type: selectedType,
      title,
      description,
      options,
    });
    alert('Question created! Check console for data.');
  };

  if (!selectedType) {
    return (
      <div className="container-sm" style={{ paddingTop: '2rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-xl)'
          }}>
            <h2>Create New Question</h2>
            <button onClick={() => navigate(-1)} className="btn btn-secondary">
              Back
            </button>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: '1.25rem' }}>
              Select Question Type
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
              <button
                onClick={() => setSelectedType('MCQ')}
                className="btn btn-primary btn-lg"
              >
                MCQ (Multiple Choice Question)
              </button>
              <button
                onClick={() => setSelectedType('DSA')}
                className="btn btn-primary btn-lg"
              >
                DSA (Data Structures & Algorithms)
              </button>
              <button
                onClick={() => setSelectedType('Sandbox')}
                className="btn btn-primary btn-lg"
              >
                Sandbox
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (selectedType === 'MCQ') {
    return (
      <div className="container-sm" style={{ paddingTop: '2rem' }}>
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            marginBottom: 'var(--spacing-xl)'
          }}>
            <h2>Create MCQ Question</h2>
            <button onClick={() => setSelectedType(null)} className="btn btn-secondary">
              Back
            </button>
          </div>

          <div className="card">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label htmlFor="title" className="form-label">Title</label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="form-input"
                  placeholder="Enter question title"
                />
              </div>

              <div className="form-group">
                <label htmlFor="description" className="form-label">Description</label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  required
                  className="form-input"
                  style={{ minHeight: '120px', resize: 'vertical' }}
                  placeholder="Enter question description"
                />
              </div>

              <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                <label className="form-label" style={{ marginBottom: 'var(--spacing-md)' }}>
                  Options
                </label>
                {options.map((option, index) => (
                  <div
                    key={option.label}
                    style={{
                      display: 'flex',
                      gap: 'var(--spacing-md)',
                      marginBottom: 'var(--spacing-md)',
                      alignItems: 'center',
                      padding: 'var(--spacing-md)',
                      borderRadius: 'var(--border-radius)',
                      border: `2px solid ${option.isCorrect ? 'var(--success)' : 'var(--border-color)'}`,
                      backgroundColor: option.isCorrect ? 'rgba(72, 187, 120, 0.1)' : 'transparent',
                    }}
                  >
                    <span style={{ 
                      fontWeight: 'bold', 
                      color: option.isCorrect ? 'var(--success)' : 'var(--text-secondary)',
                      minWidth: '30px'
                    }}>
                      {option.label}.
                    </span>
                    <input
                      type="text"
                      value={option.text}
                      onChange={(e) => handleOptionTextChange(index, e.target.value)}
                      required
                      className="form-input"
                      placeholder={`Enter option ${option.label}`}
                      style={{ flex: 1, marginBottom: 0 }}
                    />
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '0.5rem',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap'
                    }}>
                      <input
                        type="checkbox"
                        checked={option.isCorrect}
                        onChange={() => handleCorrectAnswerChange(index)}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Correct
                      </span>
                    </label>
                  </div>
                ))}
              </div>

              <button
                type="submit"
                className="btn btn-success btn-lg"
                style={{ width: '100%' }}
              >
                Create Question
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container-sm" style={{ paddingTop: '2rem' }}>
      <div className="card text-center" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>
          {selectedType} Question
        </h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
          {selectedType} question form coming soon...
        </p>
        <button onClick={() => setSelectedType(null)} className="btn btn-secondary">
          Go Back
        </button>
      </div>
    </div>
  );
};

export default CreateQuestion;
