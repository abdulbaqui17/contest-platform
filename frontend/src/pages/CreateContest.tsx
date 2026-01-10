import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { contestsAPI } from '../services/api';
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
  const navigate = useNavigate();

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
    <div style={{ maxWidth: '600px', margin: '50px auto', padding: '20px' }}>
      <h2>Create New Contest</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="title">Title:</label>
          <input
            type="text"
            id="title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="description">Description:</label>
          <textarea
            id="description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px', minHeight: '100px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="startAt">Start Time:</label>
          <input
            type="datetime-local"
            id="startAt"
            name="startAt"
            value={formData.startAt}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="endAt">End Time:</label>
          <input
            type="datetime-local"
            id="endAt"
            name="endAt"
            value={formData.endAt}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '8px', marginTop: '5px' }}
          />
        </div>
        {error && <div style={{ color: 'red', marginBottom: '15px' }}>{error}</div>}
        <button
          type="submit"
          disabled={loading}
          style={{ width: '100%', padding: '10px', backgroundColor: '#28a745', color: 'white', border: 'none' }}
        >
          {loading ? 'Creating...' : 'Create Contest'}
        </button>
      </form>
    </div>
  );
};

export default CreateContest;