import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { questionsAPI } from '../services/api';
import { QuestionDetail, CreateQuestionRequest } from '../types';

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

  if (loading) return <div>Loading questions...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div style={{ padding: '20px' }}>
      <h2>Questions for Contest {id}</h2>
      <button onClick={() => setShowForm(!showForm)} style={{ marginBottom: '20px', padding: '10px 20px' }}>
        {showForm ? 'Cancel' : 'Add New Question'}
      </button>

      {showForm && (
        <form onSubmit={handleCreateQuestion} style={{ marginBottom: '20px', padding: '20px', border: '1px solid #ddd' }}>
          <div style={{ marginBottom: '15px' }}>
            <label>Title:</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Description:</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Points:</label>
            <input
              type="number"
              value={formData.points}
              onChange={(e) => setFormData({ ...formData, points: parseInt(e.target.value) })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Time Limit (seconds):</label>
            <input
              type="number"
              value={formData.timeLimit}
              onChange={(e) => setFormData({ ...formData, timeLimit: parseInt(e.target.value) })}
              required
              style={{ width: '100%', padding: '8px', marginTop: '5px' }}
            />
          </div>
          <div style={{ marginBottom: '15px' }}>
            <label>Options:</label>
            {formData.options.map((option, index) => (
              <div key={index} style={{ marginBottom: '10px' }}>
                <input
                  type="text"
                  placeholder="Option text"
                  value={option.text}
                  onChange={(e) => updateOption(index, 'text', e.target.value)}
                  required
                  style={{ width: '70%', padding: '8px', marginRight: '10px' }}
                />
                <label>
                  <input
                    type="checkbox"
                    checked={option.isCorrect}
                    onChange={(e) => updateOption(index, 'isCorrect', e.target.checked)}
                  />
                  Correct
                </label>
              </div>
            ))}
            <button type="button" onClick={addOption} style={{ padding: '5px 10px' }}>Add Option</button>
          </div>
          <button type="submit" style={{ padding: '10px 20px' }}>Create Question</button>
        </form>
      )}

      <ul>
        {questions.map((question) => (
          <li key={question.id} style={{ marginBottom: '20px', padding: '10px', border: '1px solid #ddd' }}>
            <h3>{question.title}</h3>
            <p>{question.description}</p>
            <p>Points: {question.points}, Time: {question.timeLimit}s</p>
            <ul>
              {question.options.map((option, index) => (
                <li key={index} style={{ color: option.isCorrect ? 'green' : 'black' }}>
                  {option.text} {option.isCorrect && '(Correct)'}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Questions;